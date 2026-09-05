import { getTranslations } from "next-intl/server";
import type { QueryParams } from "@/lib/filters";
import { Link } from "@/lib/i18n/routing";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { Empty } from "@/components/ui/empty";
import {
  loadOperationContext,
  loadRouteStations,
  loadTripEntryContext,
  loadTripEntryOptions,
  loadTripsForOperation,
  type RouteStationRow,
} from "./trip-queries";
import { TripEntryGrid } from "./trip-entry-grid";

/**
 * Server-side context resolution + data loading for the fast entry grid.
 * Not a `<Drawer>` — see trip-entry-grid.tsx's header comment for why this
 * one form deviates from the usual convention.
 *
 * A trip always belongs to an existing Operation (vehicle + date + shift);
 * this never creates one. Arriving with `operationId` (from a trip's own
 * "Edit" link) skips straight to the grid; arriving with none shows the
 * (date, vehicle, shift) picker first.
 */
export async function TripEntryPanel({
  operationId,
  date,
  vehicleId,
  shiftId,
  backTo,
}: {
  operationId?: string;
  date?: string;
  vehicleId?: string;
  shiftId?: string;
  backTo: QueryParams;
}) {
  const t = await getTranslations("trips");
  const tNav = await getTranslations("nav");
  const tShift = await getTranslations("shift");
  const tCommon = await getTranslations("common");

  const options = await loadTripEntryOptions();

  const context = operationId
    ? await loadOperationContext(operationId)
    : date && vehicleId && shiftId
      ? await loadTripEntryContext(vehicleId, date, shiftId)
      : null;

  if (!context) {
    const attempted = Boolean(operationId) || Boolean(date && vehicleId && shiftId);

    return (
      <Panel clip={false}>
        <PanelHead eyebrow={tNav("operations")} title={t("newTrips")} />
        <div className="p-4">
          {attempted && (
            <div className="mb-4">
              <Empty title={t("noOperationFound")} hint={t("noOperationFoundHint")} />
            </div>
          )}

          <form method="get" className="grid max-w-md gap-3.5">
            <input type="hidden" name="entity" value="trips" />
            <input type="hidden" name="mode" value="entry" />

            <Field label={t("field.date")}>
              <TextInput type="date" name="date" defaultValue={date} required />
            </Field>

            <Field label={t("field.vehicle")}>
              <SelectInput name="vehicleId" defaultValue={vehicleId} required>
                <option value="">{t("choose")}</option>
                {options.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleCode} · {v.plateNumber}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label={t("field.shift")}>
              <SelectInput name="shiftId" defaultValue={shiftId} required>
                <option value="">{t("choose")}</option>
                {options.shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {tShift.has(s.code) ? tShift(s.code) : s.labelEn}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <Button type="submit" variant="primary">
                {t("findShift")}
              </Button>
              <Link
                href={{ pathname: "/trips", query: backTo }}
                className="rounded-control border border-hairline bg-surface px-3.5 py-2 text-center text-[13px] font-medium text-ink transition-colors hover:bg-raise"
              >
                {tCommon("cancel")}
              </Link>
            </div>
          </form>
        </div>
      </Panel>
    );
  }

  const [existingTrips, routeStopEntries] = await Promise.all([
    loadTripsForOperation(context.operationId),
    Promise.all(options.routes.map(async (r) => [r.id, await loadRouteStations(r.id)] as const)),
  ]);

  const routeStops: Record<string, RouteStationRow[]> = Object.fromEntries(routeStopEntries);

  const shift = options.shifts.find((s) => s.id === context.shiftId);
  const shiftLabel = shift ? (tShift.has(shift.code) ? tShift(shift.code) : shift.labelEn) : "—";

  return (
    <Panel clip={false}>
      <PanelHead
        eyebrow={tNav("operations")}
        title={t("newTrips")}
        actions={
          <Link
            href={{ pathname: "/trips", query: backTo }}
            className="text-[13px] text-ink-2 hover:text-ink"
          >
            {tCommon("done")}
          </Link>
        }
      />
      <div className="p-4">
        <p className="mb-4 text-[13px] text-ink-2">
          {t("entryContext", {
            vehicle: `${context.vehicleCode} · ${context.plateNumber}`,
            date: context.operationDate,
            shift: shiftLabel,
          })}
        </p>

        <TripEntryGrid
          operationId={context.operationId}
          date={context.operationDate}
          routes={options.routes}
          routeStops={routeStops}
          initialTrips={existingTrips}
          backTo={backTo}
        />
      </div>
    </Panel>
  );
}
