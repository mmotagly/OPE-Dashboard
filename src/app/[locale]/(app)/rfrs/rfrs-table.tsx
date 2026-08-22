"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { km } from "@/lib/format";
import { stagePillTone } from "./stage-tone";
import type { RfrRow } from "./queries";

export function RfrsTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: RfrRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("rfr");
  const tCommon = useTranslations("common");

  const columns: Column<RfrRow>[] = [
    {
      key: "number",
      header: t("field.number"),
      sortValue: (r) => r.rfrNumber,
      cell: (r) => <span className="tnum font-medium">{r.rfrNumber}</span>,
    },
    {
      key: "requested",
      header: t("requested"),
      className: "hidden sm:table-cell",
      sortValue: (r) => r.requestAt,
      cell: (r) => (
        <span className="tnum">{r.requestAt.slice(0, 16).replace("T", " ")}</span>
      ),
    },
    {
      key: "vehicle",
      header: t("vehicle"),
      sortValue: (r) => r.vehicleCode,
      cell: (r) => (
        <span className="tnum font-medium">
          {r.vehicleCode}
          <span className="ms-2 text-[12px] font-normal text-ink-3">{r.plateNumber}</span>
        </span>
      ),
    },
    {
      key: "driver",
      header: t("driver"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.driverName,
      cell: (r) => orDash(r.driverName),
    },
    {
      key: "km",
      header: t("kmRecord"),
      numeric: true,
      className: "hidden lg:table-cell",
      sortValue: (r) => r.odometerKm,
      cell: (r) => (r.odometerKm === null ? orDash(null) : km(r.odometerKm)),
    },
    {
      key: "location",
      header: t("location"),
      className: "hidden md:table-cell",
      sortValue: (r) => r.vehicleLocation,
      cell: (r) => orDash(r.vehicleLocation),
    },
    {
      key: "access",
      header: t("accessTime"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.accessMinutes,
      cell: (r) => (
        // Red only while the clock is actually ticking; paused reads neutral.
        <Micro tone={r.clockRunning ? "stop" : "neutral"} bar={false}>
          {r.accessDisplay}
        </Micro>
      ),
    },
    {
      key: "stage",
      header: t("stage"),
      sortValue: (r) => r.stageLabel,
      cell: (r) =>
        r.stageLabel ? (
          <Pill tone={stagePillTone(r.stageCode)}>{r.stageLabel}</Pill>
        ) : (
          orDash(null)
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/rfrs"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
