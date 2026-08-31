import express, { type NextFunction, type Request, type Response } from "express";
import { config, findCamera } from "./config.js";
import { rtspUrl, searchPlayback, searchPassengerCounts } from "./isapi.js";

/**
 * The bridge's own HTTP API — what the main app's backend calls (never a
 * browser directly, per ROADMAP_NEXT.md item 3's explicit security
 * instruction). Runs on a computer physically on the depot's local
 * network; the main app reaches it through the site's VPN/tunnel at
 * whatever `base_url` is set on the matching `camera_bridges` row. See
 * README.md for the full deployment story and the still-open questions
 * (site networking, dedicated always-on computer).
 */

const app = express();
app.use(express.json());

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!config.sharedSecret) {
    res.status(503).json({ error: "BRIDGE_SHARED_SECRET is not configured on this bridge" });
    return;
  }
  if (req.header("x-bridge-secret") !== config.sharedSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use(requireAuth);

function cameraOr404(req: Request, res: Response) {
  const camera = findCamera(req.params.cameraCode);
  if (!camera) {
    res.status(404).json({ error: `Camera "${req.params.cameraCode}" is not in cameras.config.json` });
    return null;
  }
  return camera;
}

/**
 * Live view. Returns the raw RTSP URL for now — real video delivery to a
 * browser needs either an RTSP-to-HLS/WebRTC relay running here (e.g.
 * ffmpeg piping to an HLS segment directory this server also serves) or a
 * scoped, time-limited proxy token, neither of which is built yet: doing
 * that well needs a real camera to test against, and guessing at the
 * relay's exact shape now would be the same mistake as inventing fake GPS
 * payloads. The main app's /api/cameras/[cameraId]/live route already
 * treats this as "not yet available for browser playback" rather than
 * piping the raw RTSP URL to the client — see that route's comment.
 */
app.get("/cameras/:cameraCode/rtsp-url", (req, res) => {
  const camera = cameraOr404(req, res);
  if (!camera) return;
  res.json({ rtspUrl: rtspUrl(camera) });
});

app.get("/cameras/:cameraCode/playback", async (req, res) => {
  const camera = cameraOr404(req, res);
  if (!camera) return;

  const start = String(req.query.start ?? "");
  const end = String(req.query.end ?? "");
  if (!start || !end) {
    res.status(400).json({ error: "start and end query params are required (ISO timestamps)" });
    return;
  }

  try {
    const matches = await searchPlayback(camera, start, end);
    res.json({ matches });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Playback search failed" });
  }
});

app.get("/cameras/:cameraCode/count", async (req, res) => {
  const camera = cameraOr404(req, res);
  if (!camera) return;

  const start = String(req.query.start ?? "");
  const end = String(req.query.end ?? "");
  if (!start || !end) {
    res.status(400).json({ error: "start and end query params are required (ISO timestamps)" });
    return;
  }

  try {
    const counts = await searchPassengerCounts(camera, start, end);
    res.json(counts);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Count search failed" });
  }
});

app.listen(config.port, () => {
  console.log(`Camera bridge listening on :${config.port}`);
  if (!config.sharedSecret) {
    console.warn("BRIDGE_SHARED_SECRET is not set — every authenticated route will 503.");
  }
});
