"use client";

import { useTranslations } from "next-intl";
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
      cell: (r) => <span className="tnum font-medium">{r.bridgeCode}</span>,
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
      cell: (r) => <span className="tnum font-medium">{r.cameraCode}</span>,
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
