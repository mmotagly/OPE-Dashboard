# Camera bridge (reference implementation)

Small always-on service that runs on a computer physically on the depot's
local network — the same network the Hikvision cameras are on. It talks to
the cameras over ISAPI/RTSP and exposes its own small authenticated HTTP
API for the main Pyramids Shuttle app to call. It is **not** part of the
Next.js app and is **never deployed to Vercel** — Vercel's servers cannot
reach a camera's local IP, which is the entire reason this exists
(ROADMAP_NEXT.md item 3).

```
Browser  →  Next.js app (Vercel)  →  this bridge (on-site)  →  camera (ISAPI/RTSP)
```

Never browser → bridge or browser → camera directly. That's a deliberate
security boundary from the roadmap, not an oversight: Hikvision cameras
are not designed for public exposure, and neither is this bridge — its
`base_url` should be reachable only through the site's VPN/tunnel, not a
raw port-forward to the public internet.

## What's built vs. what's still a config slot

Built and real (not fake, not guessed): the HTTP API shape below, the
Hikvision ISAPI digest-auth client (`src/isapi.ts`), the two confirmed
ISAPI calls (playback search via `/ISAPI/ContentMgmt/search`, passenger
counting via `/ISAPI/Event/channels/{id}/SearchRegionTargetNumberCounting`
— both named in ROADMAP_NEXT.md item 4 as real, working endpoints), and
the shared-secret auth between this bridge and the main app.

Config slots, empty until real hardware exists: `cameras.config.json`
(camera IP/ISAPI credentials/channel per camera — see
`cameras.config.example.json`), `BRIDGE_SHARED_SECRET`.

**Not built — the one real open item**: turning the RTSP live stream into
something a browser can actually play. `GET /cameras/:code/rtsp-url`
returns the raw `rtsp://` URL today, which a browser cannot play directly
and which this bridge does not yet relay into HLS/WebRTC/MJPEG. That
relay is a real, somewhat involved piece of work (an ffmpeg process per
active viewer, or a media server like MediaMTX in front of the cameras)
that's much better scoped once there's a real camera to test the relay
against — building it blind risks getting the framing wrong and having to
redo it. The main app's live-view route already treats this as "not yet
available," not as a working feature.

## Running it

```
cd bridge
npm install
cp .env.example .env               # fill in BRIDGE_SHARED_SECRET
cp cameras.config.example.json cameras.config.json   # fill in real cameras
npm run dev                        # or: npm run build && npm start
```

`GET /health` needs no auth and returns `{ ok: true }` once it's up — a
simple check the main app (or a monitoring tool) can poll to update
`camera_bridges.last_seen_at`.

## HTTP API

Every route below `/health` requires header `x-bridge-secret: <BRIDGE_SHARED_SECRET>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check, no auth |
| GET | `/cameras/:cameraCode/rtsp-url` | Raw RTSP URL (see the open item above) |
| GET | `/cameras/:cameraCode/playback?start=&end=` | ISO time range → matching recorded segments |
| GET | `/cameras/:cameraCode/count?start=&end=` | ISO time range → `{ enterCount, exitCount }` |

`:cameraCode` matches the `camera_code` column on the main app's `cameras`
table, resolved here against `cameras.config.json`'s `camera_code` field —
that's the join between "which camera the app is asking about" and "which
IP/credentials to actually call."

## What's needed from the business owner before this can go live

See `STATUS.md`'s vendor-requirements list for the full itemized version.
Short form:

- **A dedicated, always-on computer on the depot's local network** to run
  this bridge — a small PC or even a Raspberry Pi is enough; it just needs
  to stay powered and network-connected 24/7 and reach every camera's IP.
- **A way for the main app (on Vercel) to reach that computer** without
  exposing the cameras to the public internet — a VPN (e.g. Tailscale,
  WireGuard) or an authenticated reverse tunnel are both reasonable; a
  raw port-forward to the bridge's port on the site router is the
  minimum-viable version but has real security tradeoffs worth discussing
  before choosing it.
- **Confirmed camera IPs, ISAPI credentials (username/password), and
  RTSP/ISAPI port** for every camera that should be wired in, plus
  confirmation each camera's counting feature (if it has one) is licensed
  and enabled on the device — Hikvision's people-counting is sometimes a
  separate licensed feature, not on by default.
- **A decision on live-view delivery** (see "what's still a config slot"
  above) — whether remote live view is actually needed, or whether
  playback + counting cover the real use case and live view can wait.
