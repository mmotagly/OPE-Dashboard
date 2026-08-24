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
import { operationTone, statusLabel } from "@/lib/format";
import type { OperationRow } from "../operations/queries";

/** Statuses fn_validate_operation_status allows real operational data for —
 * every other status forbids driver/KM/battery/operating-% entirely, so
 * there's nothing for the full card to show. */
const HAS_OPERATIONAL_DATA = new Set(["operating", "completed"]);

export function OperationList({ rows }: { rows: OperationRow[] }) {
  const t = useTranslations();
  const tStatus = useTranslations("status");
  const [selected, setSelected] = useState<string | null>(rows[0]?.id ?? null);

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
                {r.routeName && (
                  <span className="ms-auto min-w-0 max-w-[45%]">
                    <Micro bar={false}>
                      <span className="min-w-0 truncate">{r.routeName}</span>
                    </Micro>
                  </span>
                )}
              </CardTop>
              <Sub>{r.plate}</Sub>
            </RecordCard>
          );
        }

        const noEnd = r.endKm === null;

        return (
          <RecordCard
            key={r.id}
            selected={selected === r.id}
            onSelect={() => setSelected(r.id)}
          >
            <CardTop>
              <Code>{r.vehicleCode}</Code>
              {pill}
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
              {/* pmProgress/pmTone are placeholder values, not real PM data —
                  pre-existing, out of scope for this pass. Kept exactly as
                  they were (tied to the same operating/completed split the
                  old endKm-derived noEnd check happened to also match) so
                  this redesign doesn't silently change that behavior. */}
              <KmMeter
                startKm={r.startKm}
                endKm={r.endKm}
                pmProgress={noEnd ? 46 : 82}
                pmTone={noEnd ? "warn" : "neutral"}
                right={
                  r.batteryStart !== null && r.batteryEnd !== null
                    ? `Battery ${r.batteryStart} → ${r.batteryEnd}%`
                    : undefined
                }
              />
            </div>

            {r.operatingPct !== null && (
              <CardFoot>
                <Micro tone="go">
                  {t("operations.operatingPct", { pct: r.operatingPct })}
                </Micro>
              </CardFoot>
            )}
          </RecordCard>
        );
      })}
    </div>
  );
}
