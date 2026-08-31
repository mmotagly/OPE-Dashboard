/**
 * Provider-agnostic shapes for GPS integration (ROADMAP_NEXT.md item 2).
 * Everything downstream of `NormalizedGpsPing` — ingestion, the
 * `vehicle_gps_pings` table, the fleet-location view — is provider-agnostic;
 * only the adapters in `./adapters/*.ts` know a specific provider's wire
 * format.
 */

export type NormalizedGpsPing = {
  /** Our own vehicle id — the adapter is responsible for resolving whatever
   * device/unit identifier the provider uses to this. */
  vehicleId: string;
  recordedAt: string; // ISO timestamp
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  headingDeg: number | null;
  odometerKm: number | null;
  ignitionOn: boolean | null;
  /** The untouched provider payload for this ping, stored as-is for
   * debugging/replay once a real adapter exists. */
  rawPayload: unknown;
};

export type GpsProvider = "etit" | "zhongtong";

/**
 * One adapter per provider. Both methods are optional because a given
 * provider might only support one integration style — ROADMAP_NEXT.md
 * flags this as unconfirmed for both candidates, so the webhook and poll
 * routes each just no-op with a clear error if the active adapter doesn't
 * implement that half.
 */
export type GpsAdapter = {
  provider: GpsProvider;
  /** True once real config (base URL, API key, ...) is present — every
   * adapter reports this itself rather than the caller guessing from env
   * var names, so a new provider's config slots stay adapter-local. */
  isConfigured(): boolean;
  /** Normalizes one webhook delivery's body into pings. Throws (never
   * silently drops) on a payload shape the adapter doesn't recognize. */
  normalizeWebhookPayload?(body: unknown): NormalizedGpsPing[];
  /** Pulls whatever is new since `sinceIso` from the provider's own API.
   * Real HTTP call — not implemented until real API docs/credentials
   * exist (ROADMAP_NEXT.md item 2: "no public API docs found yet" for
   * Etit, unknown for Zhongtong). */
  poll?(sinceIso: string): Promise<NormalizedGpsPing[]>;
};
