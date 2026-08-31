import type { GpsAdapter, GpsProvider } from "../types";
import { etitAdapter } from "./etit";
import { zhongtongAdapter } from "./zhongtong";

const ADAPTERS: Record<GpsProvider, GpsAdapter> = {
  etit: etitAdapter,
  zhongtong: zhongtongAdapter,
};

/**
 * Which provider is active, from the `GPS_PROVIDER` env var — the one
 * switch a real deployment needs to flip once a provider is chosen.
 * Everything else (routes, ingestion, the UI) calls this rather than
 * importing a specific adapter, so adding a third provider later only
 * means a new file here plus one line in `ADAPTERS`.
 */
export function activeGpsAdapter(): GpsAdapter | null {
  const provider = process.env.GPS_PROVIDER as GpsProvider | undefined;
  if (!provider) return null;
  return ADAPTERS[provider] ?? null;
}
