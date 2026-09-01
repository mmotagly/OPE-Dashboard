"use client";

import type { QueryParams } from "@/lib/filters";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Micro } from "@/components/ui/micro";
import { Pill } from "@/components/ui/pill";
import { expiryState, expiryTone, km } from "@/lib/format";
import type { VehicleRow } from "./queries";

export function VehiclesTable({
  rows,
  selectedId,
  query,
  sort,
  dir,
}: {
  rows: VehicleRow[];
  selectedId: string | null;
  query: QueryParams;
  sort: string;
  dir: string;
}) {
  const t = useTranslations("master");
  const tVehicle = useTranslations("vehicle");
  const tCommon = useTranslations("common");

  const columns: Column<VehicleRow>[] = [
    {
      key: "code",
      header: t("field.vehicleCode"),
      sortValue: (r) => r.vehicleCode,
      // The one cell that opens the standalone full-page view instead of
      // the row's usual drawer — stopPropagation keeps the row's own click
      // handler (which also opens the drawer) from firing at the same time.
      cell: (r) => (
        <Link
          href={`/vehicles/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.vehicleCode}
        </Link>
      ),
    },
    {
      key: "plate",
      header: t("field.plateNumber"),
      sortValue: (r) => r.plateNumber,
      cell: (r) => <span className="tnum">{r.plateNumber}</span>,
    },
    {
      key: "vendor",
      header: tVehicle("vendor"),
      className: "hidden md:table-cell",
      sortValue: (r) => r.vendorName,
      cell: (r) => orDash(r.vendorName),
    },
    {
      key: "type",
      header: tVehicle("type"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.vehicleTypeLabel,
      cell: (r) => orDash(r.vehicleTypeLabel),
    },
    {
      key: "driver",
      header: t("field.defaultDriver"),
      className: "hidden lg:table-cell",
      sortValue: (r) => r.defaultDriverName,
      cell: (r) => orDash(r.defaultDriverName),
    },
    {
      key: "odometer",
      header: tVehicle("odometer"),
      numeric: true,
      className: "hidden sm:table-cell",
      sortValue: (r) => r.currentOdometerKm,
      cell: (r) => (r.currentOdometerKm === null ? orDash(null) : km(r.currentOdometerKm)),
    },
    {
      key: "licence",
      header: tVehicle("licenseExpiry"),
      className: "hidden sm:table-cell",
      sortValue: (r) => r.licenseExpiryDate,
      cell: (r) => {
        if (!r.licenseExpiryDate) return orDash(null);
        const state = expiryState(r.licenseExpiryDate);
        if (state === "ok" || state === "unknown") {
          return <span className="tnum">{r.licenseExpiryDate}</span>;
        }
        return (
          <Micro tone={expiryTone(state)}>
            {state === "expired" ? t("licenceExpired") : t("licenceExpiring")}
          </Micro>
        );
      },
    },
    {
      key: "status",
      header: t("field.status"),
      sortValue: (r) => r.statusLabel,
      cell: (r) =>
        r.statusLabel ? (
          <Pill tone={r.statusCode === "active" ? "go" : "idle"}>{r.statusLabel}</Pill>
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
      pathname="/vehicles"
      query={query}
      sort={sort}
      dir={dir}
      empty={<Empty title={tCommon("empty")} hint={tCommon("emptyHint")} />}
    />
  );
}
