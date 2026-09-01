import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Panel, PanelHead } from "@/components/ui/panel";
import { FleetLocationLive } from "@/components/ui/fleet-location-live";
import { loadFleetLocations } from "./queries";

/**
 * Fleet location (roadmap: GPS Integration, item 2). Read-only — no drawer,
 * no write path; a vehicle's position comes only from a GPS ping, never
 * manual entry. Shows every vehicle regardless of whether it has a ping
 * yet, since "no GPS data" is the real, expected state for the whole fleet
 * until a provider is wired in (src/lib/gps/adapters/*.ts).
 */
export default async function FleetLocationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser(locale);

  const t = await getTranslations("fleetLocation");
  const tNav = await getTranslations("nav");

  const rows = await loadFleetLocations();
  const withPosition = rows.filter((r) => r.latitude !== null).length;

  return (
    <div className="font-inter contents">
      <Panel clip={false} fill>
        <PanelHead
          eyebrow={tNav("operations")}
          title={t("title")}
          actions={
            <span className="tnum text-ink-3">
              {t("reporting", { count: withPosition, total: rows.length })}
            </span>
          }
        />
        {withPosition === 0 && (
          <p className="border-b border-hairline px-4 py-3 text-[12.5px] text-ink-3">
            {t("noProviderHint")}
          </p>
        )}
        <FleetLocationLive initialRows={rows} />
      </Panel>
    </div>
  );
}
