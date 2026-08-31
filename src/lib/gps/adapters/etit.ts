import type { GpsAdapter, NormalizedGpsPing } from "../types";

/**
 * Etit (ETIT-FMS) adapter — one of the two GPS providers named in
 * ROADMAP_NEXT.md item 2. NTRA-licensed, hardware already installed, but no
 * public API documentation has been found yet, so this is a clearly-marked
 * config slot rather than a working integration.
 *
 * What's needed before this can do anything real, in order:
 *   1. Confirmation from Etit's account/support team that ETIT-FMS exposes a
 *      REST API or webhook (vs. being a closed platform UI only).
 *   2. If it does: the base URL, auth mechanism (API key / OAuth / basic
 *      auth), and the exact response shape for a position ping — field
 *      names for lat/lng/speed/heading/odometer/ignition, units, and how a
 *      ping is tied back to one of our vehicles (plate number? a
 *      provider-side device/unit id we'd need to map ourselves?).
 * See the vendor-requirements list in STATUS.md for the exact ask.
 */

function envConfig() {
  return {
    baseUrl: process.env.ETIT_API_BASE_URL,
    apiKey: process.env.ETIT_API_KEY,
  };
}

export const etitAdapter: GpsAdapter = {
  provider: "etit",

  isConfigured() {
    const { baseUrl, apiKey } = envConfig();
    return Boolean(baseUrl && apiKey);
  },

  // Left unimplemented on purpose — normalizing a payload shape nobody has
  // seen yet would be guessing, which CLAUDE.md-adjacent project norms
  // (evidence over confident claims) explicitly warn against. Once Etit's
  // real webhook/response shape is confirmed, replace this function body;
  // NormalizedGpsPing and everything downstream (ingest.ts, the
  // vehicle_gps_pings table, the fleet-location view) already exist.
  normalizeWebhookPayload(_body: unknown): NormalizedGpsPing[] {
    throw new Error(
      "Etit adapter is a config slot, not a working integration — ETIT_API_BASE_URL/ETIT_API_KEY " +
        "have no confirmed API to call yet. See ROADMAP_NEXT.md item 2 and STATUS.md's vendor-requirements list.",
    );
  },
};
