"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { km } from "@/lib/format";
import type { OperationRow, ShiftOption } from "./queries";

export function OperationsTable({
  rows,
  shifts,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: OperationRow[];
  shifts: ShiftOption[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("operations");
  const tStatus = useTranslations("status");
  const tShift = useTranslations("shift");
  const tCommon = useTranslations("common");

  const shiftLabel = (id: string | null) => {
    const shift = shifts.find((s) => s.id === id);
    if (!shift) return null;
    return tShift.has(shift.code) ? tShift(shift.code) : shift.labelEn;
  };

  const columns: Column<OperationRow>[] = [
    {
      key: "code",
      header: t("field.code"),
      sortValue: (r) => r.code,
      cell: (r) => <span className="tnum font-medium">{r.code}</span>,
    },
    {
      key: "date",
      header: t("field.date"),
      className: "hidden sm:table-cell",
      sortValue: (r) => r.date,
      cell: (r) => <span className="tnum">{r.date}</span>,
    },
    {
      key: "shift",
      header: t("field.shift"),
      className: "hidden sm:table-cell",
      sortValue: (r) => shiftLabel(r.shiftId),
      cell: (r) => orDash(shiftLabel(r.shiftId)),
    },
    {
      key: "vehicle",
      header: t("field.vehicle"),
      sortValue: (r) => r.vehicleCode,
      cell: (r) => (
        <span className="tnum font-medium">
          {r.vehicleCode}
          <span className="ms-2 text-[12px] font-normal text-ink-3">{r.plate}</span>
        </span>
      ),
    },
    {
      key: "driver",
      header: t("field.driver"),
      className: "hidden md:table-cell",
      sortValue: (r) => r.driverName,
      cell: (r) => orDash(r.driverName),
    },
    {
      key: "route",
      header: t("field.route"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.routeName,
      cell: (r) => orDash(r.routeName),
    },
    {
      key: "startKm",
      header: t("field.startingKm"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.startKm,
      cell: (r) => (r.startKm === null ? orDash(null) : km(r.startKm)),
    },
    {
      key: "endKm",
      header: t("field.endingKm"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.endKm,
      cell: (r) => (r.endKm === null ? orDash(null) : km(r.endKm)),
    },
    {
      key: "distance",
      header: t("field.distance"),
      numeric: true,
      className: "hidden lg:table-cell",
      sortValue: (r) => r.distanceKm,
      cell: (r) =>
        r.distanceKm === null ? (
          orDash(null)
        ) : (
          <Micro bar={false}>{t("kmDelta", { km: km(r.distanceKm) })}</Micro>
        ),
    },
    {
      key: "status",
      header: t("field.status"),
      sortValue: (r) => (r.endKm === null ? 0 : 1),
      cell: (r) => (
        <Pill tone={r.endKm === null ? "warn" : "go"}>
          {r.endKm === null ? tStatus("noEndKm") : tStatus("operating")}
        </Pill>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/operations"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
