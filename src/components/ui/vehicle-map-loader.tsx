"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

/**
 * `next/dynamic(..., { ssr: false })` is only legal inside a Client
 * Component boundary in the App Router — Leaflet touches `window` at
 * module load, which crashes Next.js's server render otherwise. This
 * wrapper exists solely to hold that boundary so `OperationDrawer` (a
 * Server Component) can render it directly with plain props.
 */
const VehicleMap = dynamic(() => import("./vehicle-map").then((m) => m.VehicleMap), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

function MapPlaceholder() {
  const tCommon = useTranslations("common");
  return (
    <div className="grid h-[220px] place-items-center rounded-[10px] bg-raise text-[12px] text-ink-3">
      {tCommon("loading")}
    </div>
  );
}

export function VehicleMapLoader(props: {
  latitude: number;
  longitude: number;
  tone: "warn" | "go";
}) {
  return <VehicleMap {...props} />;
}
