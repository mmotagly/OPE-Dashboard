"use client";

import { useTranslations } from "next-intl";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import { km, pmTone, type PmStatus } from "@/lib/format";
import type { PmAlertRow } from "./queries";

const STATUS_KEY: Record<string, string> = {
  overdue: "overdue",
  due_now: "dueNow",
};

export function PmAlertsTable({ rows }: { rows: PmAlertRow[] }) {
  const t = useTranslations("alerts");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");

  const columns: Column<PmAlertRow>[] = [
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
      key: "part",
      header: t("field.part"),
      cell: (r) => r.partName,
    },
    {
      key: "actualKm",
      header: t("field.actualKm"),
      numeric: true,
      cell: (r) => (r.actualKm === null ? orDash(null) : km(r.actualKm)),
    },
    {
      key: "scheduledKm",
      header: t("field.scheduledKm"),
      numeric: true,
      cell: (r) => (r.scheduledKm === null ? orDash(null) : km(r.scheduledKm)),
    },
    {
      key: "kmRemaining",
      header: t("field.kmRemaining"),
      numeric: true,
      sortValue: (r) => r.kmRemaining,
      cell: (r) => (r.kmRemaining === null ? orDash(null) : km(r.kmRemaining)),
    },
    {
      key: "status",
      header: t("field.status"),
      cell: (r) => (
        <Pill tone={pmTone(r.status as PmStatus)}>
          {tStatus.has(STATUS_KEY[r.status] ?? r.status)
            ? tStatus(STATUS_KEY[r.status] ?? r.status)
            : r.status}
        </Pill>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={null}
      pathname="/alerts"
      empty={<Empty title={t("noPmAlerts")} hint={tCommon("emptyHint")} />}
    />
  );
}
