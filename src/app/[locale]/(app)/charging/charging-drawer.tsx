import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Drawer, type CloseHref } from "@/components/ui/drawer";
import { Section } from "@/components/ui/panel";
import { KeyValue, Row } from "@/components/ui/key-value";
import { Pill } from "@/components/ui/pill";
import { Empty } from "@/components/ui/empty";
import {
  EMPTY_CHARGING_FORM,
  loadChargingOptions,
  loadChargingSession,
  toChargingFormValues,
  type ChargingRow,
} from "./queries";
import { ChargingForm } from "./charging-form";

const stamp = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : null);

/**
 * View-mode body, factored out so `/charging/[id]` (reached by clicking a
 * session's code, as opposed to elsewhere in the row) can render the exact
 * same content as the Drawer without duplicating it. See CLAUDE.md's
 * row-click-vs-code-link convention.
 */
export async function ChargingDetailBody({ session }: { session: ChargingRow }) {
  const t = await getTranslations("charging");

  return (
    <>
      <Section title={t("session")}>
        <KeyValue>
          <Row label={t("field.vehicle")}>
            {session.vehicleCode}
            <span className="ms-2 text-[12px] text-ink-3">{session.plateNumber}</span>
          </Row>
          <Row label={t("field.charger")}>
            {session.chargerCode}
            {session.chargerLocation && (
              <span className="ms-2 text-[12px] text-ink-3">{session.chargerLocation}</span>
            )}
          </Row>
          <Row label={t("field.plugs")}>{session.plugsUsed}</Row>
          <Row label={t("field.startTime")}>
            {stamp(session.startTime) ? (
              <span className="tnum">{stamp(session.startTime)}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.endTime")}>
            {stamp(session.endTime) ? (
              <span className="tnum">{stamp(session.endTime)}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("field.duration")} hint={t("generated")} muted>
            {/* Generated column — read, never written. */}
            {session.duration ? <span className="tnum">{session.duration}</span> : "—"}
          </Row>
          <Row label={t("field.battery")}>
            {session.batteryStartPct === null && session.batteryEndPct === null
              ? "—"
              : t("batteryRange", {
                  from: session.batteryStartPct ?? "—",
                  to: session.batteryEndPct ?? "—",
                })}
          </Row>
          <Row label={t("field.energy")} muted>
            {session.energyKwh === null ? (
              "—"
            ) : (
              <span className="tnum">{session.energyKwh} kWh</span>
            )}
          </Row>
        </KeyValue>
      </Section>

      {session.notes && (
        <Section title={t("field.notes")}>
          <p className="text-[13px] leading-relaxed text-ink-2">{session.notes}</p>
        </Section>
      )}
    </>
  );
}

export async function ChargingDrawer({
  mode,
  id,
  closeHref,
  canEdit,
}: {
  mode: "view" | "new" | "edit";
  id?: string;
  closeHref: CloseHref;
  canEdit: boolean;
}) {
  const t = await getTranslations("charging");
  const tCommon = await getTranslations("common");

  if (mode === "new" || mode === "edit") {
    const [options, session] = await Promise.all([
      loadChargingOptions(),
      mode === "edit" && id ? loadChargingSession(id) : null,
    ]);

    if (mode === "edit" && !session) {
      return (
        <Drawer code={t("edit")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
          <Empty title={t("notFound")} hint={t("notFoundHint")} />
        </Drawer>
      );
    }

    return (
      <Drawer
        code={session ? `${t("edit")} · ${session.sessionCode}` : t("new")}
        sub={session ? `${session.vehicleCode} · ${session.chargerCode}` : undefined}
        closeHref={closeHref}
        closeLabel={tCommon("cancel")}
      >
        <ChargingForm
          mode={session ? "edit" : "create"}
          sessionId={session?.id}
          options={options}
          initial={session ? toChargingFormValues(session) : EMPTY_CHARGING_FORM}
          backTo={closeHref.query}
        />
      </Drawer>
    );
  }

  const session = id ? await loadChargingSession(id) : null;

  if (!session) {
    return (
      <Drawer code={t("noSelection")} closeHref={closeHref} closeLabel={tCommon("cancel")}>
        <Empty title={t("noSelection")} hint={t("noSelectionHint")} />
      </Drawer>
    );
  }

  return (
    <Drawer
      code={session.sessionCode}
      sub={`${session.vehicleCode} · ${session.plateNumber}`}
      pill={<Pill tone="idle">{session.plugsUsed}</Pill>}
      closeHref={closeHref}
      closeLabel={tCommon("cancel")}
      footer={
        canEdit ? (
          <Link
            href={{
              pathname: "/charging",
              query: { ...closeHref.query, mode: "edit", id: session.id },
            }}
            className="rounded-control border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-on-ink transition-opacity hover:opacity-90"
          >
            {tCommon("edit")}
          </Link>
        ) : undefined
      }
    >
      <ChargingDetailBody session={session} />
    </Drawer>
  );
}
