"use client";

import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import type { VendorBusDays } from "./queries";

export function VendorBusDaysTable({ rows }: { rows: VendorBusDays[] }) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const columns: Column<VendorBusDays>[] = [
    {
      key: "vendor",
      header: t("field.vendor"),
      sortValue: (r) => r.vendorName,
      cell: (r) => (
        <span className="font-medium">
          {r.vendorName}
          <span className="ms-2 text-[12px] font-normal text-ink-3">{r.vendorCode}</span>
        </span>
      ),
    },
    {
      key: "busDays",
      header: t("field.busDays"),
      numeric: true,
      sortValue: (r) => r.busDays,
      cell: (r) => r.busDays,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows.map((r) => ({ ...r, id: r.vendorId }))}
      selectedId={null}
      pathname="/dashboard"
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
