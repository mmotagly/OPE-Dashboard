"use client";

import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import type { FleetLocationRow } from "./queries";

export function FleetLocationTable({ rows }: { rows: FleetLocationRow[] }) {
  const t = useTranslations("fleetLocation");
  const tCommon = useTranslations("common");

  const columns: Column<FleetLocationRow>[] = [
    {
      key: "vehicle",
      header: t("field.vehicle"),
      sortValue: (r) => r.vehicleCode,
      cell: (r) => (
        <span className="tnum font-medium">
          {r.vehicleCode}
          <span className="ms-2 text-[12px] font-normal text-ink-3">{r.plateNumber}</span>
        </span>
      ),
    },
    {
      key: "vendor",
      header: t("field.vendor"),
      cell: (r) => r.vendorName ?? orDash(null),
    },
    {
      key: "position",
      header: t("field.position"),
      numeric: true,
      cell: (r) =>
        r.latitude !== null && r.longitude !== null ? (
          <span className="tnum">
            {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
          </span>
        ) : (
          orDash(null)
        ),
    },
    {
      key: "speed",
      header: t("field.speed"),
      numeric: true,
      cell: (r) => (r.speedKmh === null ? orDash(null) : <span className="tnum">{r.speedKmh} km/h</span>),
    },
    {
      key: "ignition",
      header: t("field.ignition"),
      cell: (r) =>
        r.ignitionOn === null ? (
          orDash(null)
        ) : (
          <Pill tone={r.ignitionOn ? "go" : "idle"}>
            {r.ignitionOn ? t("ignitionOn") : t("ignitionOff")}
          </Pill>
        ),
    },
    {
      key: "lastSeen",
      header: t("field.lastSeen"),
      sortValue: (r) => r.recordedAt ?? "",
      cell: (r) => (r.recordedAt ? <span className="tnum">{new Date(r.recordedAt).toLocaleString()}</span> : orDash(null)),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={null}
      pathname="/fleet-location"
      empty={<Empty title={t("noVehicles")} hint={tCommon("emptyHint")} />}
    />
  );
}
