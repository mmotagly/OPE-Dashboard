"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { FleetLocationRow } from "@/app/[locale]/(app)/fleet-location/queries";

/** Same reason as vehicle-map-loader.tsx: Leaflet touches `window` at
 * module load, which crashes SSR unless dynamically imported with
 * `ssr: false` from inside a Client Component boundary — so the Server
 * Component page can render this directly with plain props. */
const FleetLocationMap = dynamic(
  () => import("./fleet-location-map").then((m) => m.FleetLocationMap),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

function MapPlaceholder() {
  const tCommon = useTranslations("common");
  return (
    <div className="grid h-[320px] place-items-center rounded-[10px] bg-raise text-[12px] text-ink-3">
      {tCommon("loading")}
    </div>
  );
}

export function FleetLocationMapLoader(props: { initialRows: FleetLocationRow[] }) {
  return <FleetLocationMap {...props} />;
}
