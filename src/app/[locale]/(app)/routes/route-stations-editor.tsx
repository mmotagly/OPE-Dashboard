"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { SelectInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Micro } from "@/components/ui/micro";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { editRouteStations } from "./actions";
import type { RouteOptions, RouteStationRow } from "./queries";

/**
 * The route's stop list. Add appends to the end; the arrows swap neighbours and
 * the server rewrites the whole sequence, so positions stay 1..n with no gaps.
 * Add, move and remove all post to one action, hence one error line.
 */
export function RouteStationsEditor({
  routeId,
  stops,
  options,
  canEdit,
}: {
  routeId: string;
  stops: RouteStationRow[];
  options: RouteOptions;
  canEdit: boolean;
}) {
  const t = useTranslations("master");
  const [state, formAction, pending] = useActionState(
    editRouteStations.bind(null, routeId),
    EMPTY_FORM_STATE,
  );
  const [stationId, setStationId] = useState("");

  const onRoute = new Set(stops.map((s) => s.stationId));
  const available = options.stations.filter((s) => !onRoute.has(s.id));

  return (
    <div className={`grid gap-3 ${pending ? "opacity-60" : ""}`}>
      {stops.length === 0 ? (
        <p className="text-[13px] text-ink-3">{t("noStops")}</p>
      ) : (
        <ol className="grid gap-1.5">
          {stops.map((stop, index) => (
            <li
              key={stop.id}
              className="flex items-center gap-3 rounded-control border border-hairline bg-canvas px-3 py-2.5"
            >
              <span className="tnum w-6 shrink-0 text-[12.5px] font-semibold text-ink-3">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="tnum text-[13.5px] font-medium">{stop.stationCode}</span>
                <span className="ms-2 text-[12.5px] text-ink-2">{stop.stationName}</span>
              </span>

              {canEdit && (
                <span className="ms-auto flex shrink-0 items-center gap-1">
                  <StopButton
                    action={formAction}
                    intent="moveUp"
                    routeStationId={stop.id}
                    disabled={pending || index === 0}
                    label={t("moveUp")}
                  >
                    ↑
                  </StopButton>
                  <StopButton
                    action={formAction}
                    intent="moveDown"
                    routeStationId={stop.id}
                    disabled={pending || index === stops.length - 1}
                    label={t("moveDown")}
                  >
                    ↓
                  </StopButton>
                  <StopButton
                    action={formAction}
                    intent="remove"
                    routeStationId={stop.id}
                    disabled={pending}
                    label={t("removeStop")}
                    danger
                  >
                    ×
                  </StopButton>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit && (
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="intent" value="add" />
          <div className="min-w-[200px] flex-1">
            <SelectInput
              name="stationId"
              aria-label={t("addStop")}
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
            >
              <option value="">{t("chooseStation")}</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.stationCode} · {s.stationName}
                </option>
              ))}
            </SelectInput>
          </div>
          <Button type="submit" disabled={pending || stationId === ""}>
            {t("addStop")}
          </Button>
        </form>
      )}

      {state.formError && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.formError}`)}
        </p>
      )}
      {state.fieldErrors.stationId && (
        <p role="alert" className="text-[12px] text-stop-text">
          {t(`error.${state.fieldErrors.stationId}`)}
        </p>
      )}

      {stops.length > 0 && (
        <Micro bar={false}>{t("stopCount", { count: stops.length })}</Micro>
      )}
    </div>
  );
}

/** One-button form so each row posts its own intent to the shared action. */
function StopButton({
  action,
  intent,
  routeStationId,
  disabled,
  label,
  danger = false,
  children,
}: {
  action: (formData: FormData) => void;
  intent: string;
  routeStationId: string;
  disabled: boolean;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="routeStationId" value={routeStationId} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        title={label}
        className={`grid h-8 w-8 place-items-center rounded-control border border-hairline text-[13px] transition-colors disabled:opacity-30 ${
          danger ? "text-stop-text hover:bg-stop-soft" : "text-ink-2 hover:bg-raise"
        }`}
      >
        {children}
      </button>
    </form>
  );
}
