import { createHash, randomBytes } from "node:crypto";
import type { CameraConfig } from "./config.js";

/**
 * Hikvision ISAPI client. ISAPI is HTTP/REST, confirmed in ROADMAP_NEXT.md
 * item 3 as the real protocol these cameras speak, so — unlike the GPS
 * adapters, which stub out because the provider's wire format is
 * genuinely unconfirmed — this is a real implementation of a documented
 * protocol, config-slotted only for the actual camera IP/credentials
 * (`cameras.config.json`, never checked in).
 *
 * Most Hikvision devices default to HTTP Digest auth (RFC 7616) on ISAPI.
 * `digestRequest` below does the standard two-round-trip digest handshake
 * with Node's built-in `fetch` and `crypto` — no extra HTTP/auth
 * dependency needed. If a specific device is set to Basic auth instead,
 * that's a one-line change in `digestRequest`'s retry (see the comment
 * there) once real hardware confirms which mode it's in.
 */

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

function parseWwwAuthenticate(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  // realm="...", qop="auth", nonce="...", opaque="..." — a light parser for
  // exactly this header shape, not a general HTTP-auth-header parser.
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header))) {
    out[m[1]] = m[2] ?? m[3];
  }
  return out;
}

async function digestRequest(
  camera: CameraConfig,
  path: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const url = `http://${camera.ip}:${camera.port}${path}`;
  const method = init.method ?? "GET";

  const first = await fetch(url, { method, body: init.body, headers: init.headers });
  if (first.status !== 401) return first; // device accepted an unauthenticated/Basic call

  const authHeader = first.headers.get("www-authenticate");
  if (!authHeader) return first;

  if (/^basic/i.test(authHeader)) {
    const basic = Buffer.from(`${camera.isapiUsername}:${camera.isapiPassword}`).toString(
      "base64",
    );
    return fetch(url, {
      method,
      body: init.body,
      headers: { ...init.headers, Authorization: `Basic ${basic}` },
    });
  }

  const params = parseWwwAuthenticate(authHeader);
  const nc = "00000001";
  const cnonce = randomBytes(8).toString("hex");
  const ha1 = md5(`${camera.isapiUsername}:${params.realm}:${camera.isapiPassword}`);
  const ha2 = md5(`${method}:${path}`);
  const response =
    params.qop === "auth" || params.qop === "auth-int"
      ? md5(`${ha1}:${params.nonce}:${nc}:${cnonce}:${params.qop}:${ha2}`)
      : md5(`${ha1}:${params.nonce}:${ha2}`);

  const authValue =
    `Digest username="${camera.isapiUsername}", realm="${params.realm}", ` +
    `nonce="${params.nonce}", uri="${path}", response="${response}"` +
    (params.qop ? `, qop=${params.qop}, nc=${nc}, cnonce="${cnonce}"` : "") +
    (params.opaque ? `, opaque="${params.opaque}"` : "");

  return fetch(url, {
    method,
    body: init.body,
    headers: { ...init.headers, Authorization: authValue },
  });
}

/** Raw RTSP URL for live view. The bridge never hands this to a browser —
 * it's for the bridge's own relay process (see README.md's "live view"
 * section on the still-open transcode question) or for a trusted
 * server-to-server caller only. */
export function rtspUrl(camera: CameraConfig): string {
  return `rtsp://${camera.isapiUsername}:${camera.isapiPassword}@${camera.ip}:554/Streaming/Channels/${camera.channel}01`;
}

/**
 * Recorded-footage search for a time range, via ISAPI's ContentMgmt
 * search endpoint (POST, XML body) — the standard Hikvision playback
 * query. Returns the raw parsed matches; the caller (server.ts) decides
 * what to do with them.
 */
export async function searchPlayback(
  camera: CameraConfig,
  startIso: string,
  endIso: string,
): Promise<{ trackID: number; startTime: string; endTime: string; playbackURI: string }[]> {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<CMSearchDescription>` +
    `<searchID>${randomBytes(8).toString("hex")}</searchID>` +
    `<trackList><trackID>${camera.channel}01</trackID></trackList>` +
    `<timeSpanList><timeSpan><startTime>${startIso}</startTime><endTime>${endIso}</endTime></timeSpan></timeSpanList>` +
    `<maxResults>40</maxResults><searchResultPosition>0</searchResultPosition>` +
    `<metadataList><metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor></metadataList>` +
    `</CMSearchDescription>`;

  const res = await digestRequest(camera, "/ISAPI/ContentMgmt/search", {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body,
  });

  if (!res.ok) {
    throw new Error(`ISAPI playback search failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  // A small tag-scraper rather than a full XML parser — no XML dependency
  // for a handful of flat fields. If a device's response nests these
  // differently, this is the one place to adjust once tested against
  // real hardware.
  const matches: { trackID: number; startTime: string; endTime: string; playbackURI: string }[] =
    [];
  const itemRe = /<searchMatchItem>([\s\S]*?)<\/searchMatchItem>/g;
  let item: RegExpExecArray | null;
  while ((item = itemRe.exec(xml))) {
    const block = item[1];
    const field = (tag: string) => new RegExp(`<${tag}>([^<]*)<\/${tag}>`).exec(block)?.[1] ?? "";
    matches.push({
      trackID: Number(field("trackID")),
      startTime: field("startTime"),
      endTime: field("endTime"),
      playbackURI: field("playbackURI"),
    });
  }
  return matches;
}

/**
 * Passenger counting for a time range, via the two real endpoints
 * ROADMAP_NEXT.md item 4 already names:
 * `/ISAPI/Event/channels/{id}/SearchRegionTargetNumberCounting` (periodic
 * enter/exit totals for a window). The alertStream endpoint (real-time
 * push) is a separate long-lived-connection pattern, not a request/
 * response call — left for `server.ts` to open directly rather than
 * wrapping it here.
 */
export async function searchPassengerCounts(
  camera: CameraConfig,
  startIso: string,
  endIso: string,
): Promise<{ enterCount: number; exitCount: number }> {
  const path = `/ISAPI/Event/channels/${camera.channel}/SearchRegionTargetNumberCounting`;
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<RegionTargetNumberCountingSearchCond>` +
    `<startTime>${startIso}</startTime><endTime>${endIso}</endTime>` +
    `<statType>enterAndLeave</statType>` +
    `</RegionTargetNumberCountingSearchCond>`;

  const res = await digestRequest(camera, path, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body,
  });

  if (!res.ok) {
    throw new Error(`ISAPI passenger-count search failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  const field = (tag: string) => new RegExp(`<${tag}>([^<]*)<\/${tag}>`).exec(xml)?.[1] ?? "0";
  return {
    enterCount: Number(field("enterNum")),
    exitCount: Number(field("leaveNum")),
  };
}

/** Long-lived multipart event stream for real-time counting pushes. Caller
 * is responsible for parsing the multipart boundary and closing the
 * stream — kept as a raw Response so server.ts's SSE bridge (or a future
 * consumer) controls its own read loop rather than this module choosing
 * a framing for it. */
export function openAlertStream(camera: CameraConfig): Promise<Response> {
  return digestRequest(camera, "/ISAPI/Event/notification/alertStream");
}
