import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Micro } from "@/components/ui/micro";
import { Empty } from "@/components/ui/empty";
import { time } from "@/lib/format";
import { loadTrip, type TripDetail } from "./trip-queries";

const actionLink =
  "rounded-control border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raise";

/**
 * View-mode body, factored out so `/trips/[id]?entity=trip` (reached by
 * clicking a trip's code) renders the exact same content as the Drawer.
 * See CLAUDE.md's row-click-vs-code-link convention.
 */
export async function TripDetailBody({ trip }: { trip: TripDetail }) {
  const t = await getTranslations("trips");

  const outbound = trip.stops.filter((s) => s.direction === "outbound");
  const returnLeg = trip.stops.filter((s) => s.direction === "return");

  return (
    <>
      <Section title={t("record")}>
        <KeyValue>
          <Row label={t("field.vehicle")}>
            <span className="tnum font-medium">{trip.vehicleCode}</span>
            <span className="ms-2 text-[12px] text-ink-3">{trip.plateNumber}</span>
          </Row>
          <Row label={t("field.route")} muted>
            <span className="tnum">{trip.routeCode}</span>
            <span className="ms-2 text-[12.5px] text-ink-2">{trip.routeName}</span>
          </Row>
          <Row label={t("field.date")}>
            <span className="tnum">{trip.tripDate}</span>
          </Row>
        </KeyValue>
      </Section>

      <Section title={t("direction.outbound")}>
        {outbound.length === 0 ? (
          <Empty title={t("noStopsRecorded")} />
        ) : (
          <KeyValue>
            {outbound.map((s) => (
              <Row key={s.id} label={`${s.stationCode} · ${s.stationName}`}>
                <span className="tnum">{time(s.departureAt)}</span>
              </Row>
            ))}
          </KeyValue>
        )}
        {trip.outboundLegDisplay && (
          <div className="mt-2.5">
            <Micro bar={false}>{t("legTimeValue", { time: trip.outboundLegDisplay })}</Micro>
          </div>
        )}
      </Section>

      {returnLeg.length > 0 && (
        <Section title={t("direction.return")}>
          <KeyValue>
            {returnLeg.map((s) => (
              <Row key={s.id} label={`${s.stationCode} · ${s.stationName}`}>
                <span className="tnum">{time(s.departureAt)}</span>
              </Row>
            ))}
          </KeyValue>
          {trip.returnLegDisplay && (
            <div className="mt-2.5">
              <Micro bar={false}>{t("legTimeValue", { time: trip.returnLegDisplay })}</Micro>
            </div>
          )}
        </Section>
      )}

      {trip.roundTripDisplay && (
        <Section title={t("field.roundTripTime")}>
          <p className="tnum text-[18px] font-semibold text-ink">{trip.roundTripDisplay}</p>
        </Section>
      )}
    </>
  );
}

export async function TripDrawer({
  id,
  closeHref,
  canEdit,
}: {
  id?: string;
  closeHref: CloseHref;
  canEdit: boolean;
}) {
  const t = await getTranslations("trips");
  const tCommon = await getTranslations("common");

  const trip = id ? await loadTrip(id) : null;

  if (!trip) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  return (
    <Drawer
      code={trip.tripCode}
      sub={`${trip.vehicleCode} · ${trip.routeCode}`}
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{
              pathname: "/trips",
              query: { entity: "trips", mode: "entry", operationId: trip.operationId },
            }}
            className={`${actionLink} border-ink bg-ink text-on-ink hover:opacity-90`}
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <TripDetailBody trip={trip} />
    </Drawer>
  );
}
