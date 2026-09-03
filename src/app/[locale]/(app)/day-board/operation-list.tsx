"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  RecordCard,
  CardTop,
  Code,
  Sub,
  CardFoot,
} from "@/components/ui/record-card";
import { Pill } from "@/components/ui/pill";
import { Micro } from "@/components/ui/micro";
import { KmMeter } from "@/components/ui/km-meter";
import { km, operationTone, pmBarTone, statusLabel } from "@/lib/format";
import type { NearestPm, OperationRow, ShiftOption } from "../operations/queries";

/** Statuses fn_validate_operation_status allows real operational data for —
 * every other status forbids driver/KM/battery/operating-% entirely, so
 * there's nothing for the full card to show. */
const HAS_OPERATIONAL_DATA = new Set(["operating", "completed"]);

export function OperationList({
  rows,
  pmByVehicle,
  shifts,
}: {
  rows: OperationRow[];
  pmByVehicle: Map<string, NearestPm>;
  shifts: ShiftOption[];
}) {
  const t = useTranslations();
  const tStatus = useTranslations("status");
  const tShift = useTranslations("shift");
  const [selected, setSelected] = useState<string | null>(rows[0]?.id ?? null);

  // Same resolution operations-table.tsx uses: prefer the translated label
  // for the fixed morning/night codes, fall back to the DB's own label for
  // anything else.
  const shiftLabel = (id: string | null) => {
    const shift = shifts.find((s) => s.id === id);
    if (!shift) return null;
    return tShift.has(shift.code) ? tShift(shift.code) : shift.labelEn;
  };

  return (
    <div className="p-1.5">
      {rows.map((r) => {
        const pill = (
          <Pill tone={operationTone(r.statusCode ?? "")}>
            {statusLabel(tStatus, {
              code: r.statusCode ?? "",
              labelEn: r.statusLabel ?? r.statusCode ?? "",
            }) ?? "—"}
          </Pill>
        );

        // Planned / Cancelled x3 / Under Maintenance have every operational
        // field null by design (fn_validate_operation_status forbids
        // setting them) — a compact card avoids a shell full of blanks.
        if (r.statusCode === null || !HAS_OPERATIONAL_DATA.has(r.statusCode)) {
          return (
            <RecordCard
              key={r.id}
              selected={selected === r.id}
              onSelect={() => setSelected(r.id)}
            >
              <CardTop>
                <Code>{r.vehicleCode}</Code>
                {pill}
                {shiftLabel(r.shiftId) && <Micro bar={false}>{shiftLabel(r.shiftId)}</Micro>}
                {r.routeName && (
                  <span className="ms-auto min-w-0 max-w-[45%]">
                    <Micro bar={false}>
                      <span className="min-w-0 truncate">{r.routeName}</span>
                    </Micro>
                  </span>
                )}
              </CardTop>
              <Sub>
                {r.plate} · {r.vendorName}
              </Sub>
              {r.remarks && (
                <CardFoot>
                  <span className="min-w-0 truncate text-[12.5px] text-ink-3">{r.remarks}</span>
                </CardFoot>
              )}
            </RecordCard>
          );
        }

        const pm = r.vehicleId ? pmByVehicle.get(r.vehicleId) ?? null : null;
        const pmProgress =
          pm && pm.intervalKm !== null && pm.intervalKm > 0 && pm.kmRemaining !== null
            ? ((pm.intervalKm - pm.kmRemaining) / pm.intervalKm) * 100
            : null;

        return (
          <RecordCard
            key={r.id}
            selected={selected === r.id}
            onSelect={() => setSelected(r.id)}
          >
            <CardTop>
              <Code>{r.vehicleCode}</Code>
              {pill}
              {shiftLabel(r.shiftId) && <Micro bar={false}>{shiftLabel(r.shiftId)}</Micro>}
              {r.routeName && (
                <span className="ms-auto min-w-0 max-w-[45%]">
                  <Micro bar={false}>
                    <span className="min-w-0 truncate">{r.routeName}</span>
                  </Micro>
                </span>
              )}
            </CardTop>

            <Sub>
              {r.plate} · {r.vendorName}
            </Sub>

            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <span className="text-[13.5px]">{r.driverName ?? "—"}</span>
              {r.driverCode && <Micro bar={false}>{r.driverCode}</Micro>}
            </div>

            <div className="mt-2.5">
              <KmMeter
                startKm={r.startKm}
                endKm={r.endKm}
                pmProgress={pmProgress}
                pmTone={pmBarTone(pm?.status ?? null)}
                pmLabel={pm ? t("operations.pmLabel", { part: pm.partName, km: km(pm.kmRemaining) }) : undefined}
                right={
                  r.batteryStart !== null && r.batteryEnd !== null
                    ? `Battery ${r.batteryStart} → ${r.batteryEnd}%`
                    : undefined
                }
              />
            </div>

            {(r.operatingPct !== null || r.remarks) && (
              <CardFoot>
                {r.operatingPct !== null && (
                  <Micro tone="go">
                    {t("operations.operatingPct", { pct: r.operatingPct })}
                  </Micro>
                )}
                {r.remarks && (
                  <span className="min-w-0 truncate text-[12.5px] text-ink-3">{r.remarks}</span>
                )}
              </CardFoot>
            )}
          </RecordCard>
        );
      })}
    </div>
  );
}
