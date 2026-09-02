"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { DataTable, orDash, type Column } from "@/components/ui/data-table";
import { Empty } from "@/components/ui/empty";
import { Pill } from "@/components/ui/pill";
import type { QueryParams } from "@/lib/filters";
import type { CameraBridgeRow, CameraRow } from "./queries";

export function CameraBridgesTable({
  rows,
  selectedId,
  query,
}: {
  rows: CameraBridgeRow[];
  selectedId: string | null;
  query: QueryParams;
}) {
  const t = useTranslations("cameras");
  const tCommon = useTranslations("common");

  const columns: Column<CameraBridgeRow>[] = [
    {
      key: "bridgeCode",
      header: t("field.bridgeCode"),
      sortValue: (r) => r.bridgeCode,
      // The one cell that opens the standalone full-page view instead of
      // the row's usual drawer — stopPropagation keeps the row's own click
      // handler (which also opens the drawer) from firing at the same time.
      cell: (r) => (
        <Link
          href={`/cameras/${r.id}?entity=bridge`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.bridgeCode}
        </Link>
      ),
    },
    { key: "siteName", header: t("field.siteName"), cell: (r) => r.siteName },
    {
      key: "baseUrl",
      header: t("field.baseUrl"),
      cell: (r) => (r.baseUrl ? <span className="tnum text-ink-2">{r.baseUrl}</span> : orDash(null)),
    },
    {
      key: "cameraCount",
      header: t("field.cameraCount"),
      numeric: true,
      cell: (r) => <span className="tnum">{r.cameraCount}</span>,
    },
    {
      key: "isActive",
      header: t("field.status"),
      cell: (r) => <Pill tone={r.isActive ? "go" : "idle"}>{r.isActive ? t("active") : t("inactive")}</Pill>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/cameras"
      query={query}
      empty={<Empty title={t("noBridges")} hint={tCommon("emptyHint")} />}
    />
  );
}

export function CamerasTable({
  rows,
  selectedId,
  query,
}: {
  rows: CameraRow[];
  selectedId: string | null;
  query: QueryParams;
}) {
  const t = useTranslations("cameras");
  const tCommon = useTranslations("common");

  const columns: Column<CameraRow>[] = [
    {
      key: "cameraCode",
      header: t("field.cameraCode"),
      sortValue: (r) => r.cameraCode,
      // The one cell that opens the standalone full-page view instead of
      // the row's usual drawer — stopPropagation keeps the row's own click
      // handler (which also opens the drawer) from firing at the same time.
      cell: (r) => (
        <Link
          href={`/cameras/${r.id}?entity=camera`}
          onClick={(e) => e.stopPropagation()}
          className="tnum font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2 hover:decoration-ink-2"
        >
          {r.cameraCode}
        </Link>
      ),
    },
    { key: "bridgeCode", header: t("field.bridge"), cell: (r) => r.bridgeCode },
    {
      key: "location",
      header: t("field.location"),
      cell: (r) => r.vehicleCode ?? r.stationName ?? orDash(null),
    },
    {
      key: "isapiChannel",
      header: t("field.isapiChannel"),
      numeric: true,
      cell: (r) => <span className="tnum">{r.isapiChannel}</span>,
    },
    {
      key: "capabilities",
      header: t("field.capabilities"),
      cell: (r) => (
        <span className="flex justify-end gap-1.5">
          {r.supportsLive && <Pill tone="idle">{t("live")}</Pill>}
          {r.supportsCounting && <Pill tone="idle">{t("counting")}</Pill>}
        </span>
      ),
    },
    {
      key: "isActive",
      header: t("field.status"),
      cell: (r) => <Pill tone={r.isActive ? "go" : "idle"}>{r.isActive ? t("active") : t("inactive")}</Pill>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      selectedId={selectedId}
      pathname="/cameras"
      query={query}
      empty={<Empty title={t("noCameras")} hint={tCommon("emptyHint")} />}
    />
  );
}
