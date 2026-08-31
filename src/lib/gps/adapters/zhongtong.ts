import type { GpsAdapter, NormalizedGpsPing } from "../types";

/**
 * Zhongtong adapter — the bus manufacturer's built-in telematics unit,
 * the other candidate in ROADMAP_NEXT.md item 2. Manufacturer-installed
 * units are frequently locked to a proprietary app with no public
 * integration path, so this is the lower-probability provider and its
 * config slot is even more speculative than Etit's.
 *
 * What's needed before this can do anything real:
 *   1. Whether Zhongtong (or a local distributor/dealer) exposes any API
 *      or data-export path at all for the installed units — this is
 *      unconfirmed, not just undocumented.
 *   2. If one exists: the same detail as Etit — base URL/auth, ping
 *      response shape, and how a ping maps back to one of our vehicles.
 * See the vendor-requirements list in STATUS.md for the exact ask.
 */

function envConfig() {
  return {
    baseUrl: process.env.ZHONGTONG_API_BASE_URL,
    apiKey: process.env.ZHONGTONG_API_KEY,
  };
}

export const zhongtongAdapter: GpsAdapter = {
  provider: "zhongtong",

  isConfigured() {
    const { baseUrl, apiKey } = envConfig();
    return Boolean(baseUrl && apiKey);
  },

  normalizeWebhookPayload(_body: unknown): NormalizedGpsPing[] {
    throw new Error(
      "Zhongtong adapter is a config slot, not a working integration — no confirmed API exists yet. " +
        "See ROADMAP_NEXT.md item 2 and STATUS.md's vendor-requirements list.",
    );
  },
};
