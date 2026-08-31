/**
 * Client for calling a site's camera bridge (roadmap item 3) — the one
 * piece of server code allowed to know a bridge's `base_url` exists at
 * all. Never called from a Client Component; the API routes under
 * `src/app/api/cameras/` are the only callers, so a browser never talks
 * to the bridge or the camera directly (ROADMAP_NEXT.md item 3's explicit
 * security instruction).
 */

export class BridgeUnreachableError extends Error {}

async function callBridge(baseUrl: string, path: string): Promise<unknown> {
  const secret = process.env.CAMERA_BRIDGE_SHARED_SECRET;
  if (!secret) {
    throw new BridgeUnreachableError("CAMERA_BRIDGE_SHARED_SECRET is not configured");
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      headers: { "x-bridge-secret": secret },
      // Bridges live on-site behind a VPN/tunnel that may be slow or down —
      // fail fast rather than hanging a Server Action/route for minutes.
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    throw new BridgeUnreachableError(
      e instanceof Error ? e.message : "Could not reach the camera bridge",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new BridgeUnreachableError(`Bridge returned ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

export function fetchPlayback(
  baseUrl: string,
  cameraCode: string,
  startIso: string,
  endIso: string,
) {
  const qs = new URLSearchParams({ start: startIso, end: endIso });
  return callBridge(baseUrl, `/cameras/${encodeURIComponent(cameraCode)}/playback?${qs}`) as Promise<{
    matches: { trackID: number; startTime: string; endTime: string; playbackURI: string }[];
  }>;
}

export function fetchPassengerCount(
  baseUrl: string,
  cameraCode: string,
  startIso: string,
  endIso: string,
) {
  const qs = new URLSearchParams({ start: startIso, end: endIso });
  return callBridge(baseUrl, `/cameras/${encodeURIComponent(cameraCode)}/count?${qs}`) as Promise<{
    enterCount: number;
    exitCount: number;
  }>;
}
