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

export type OperationRow = {
  id: string;
  code: string;
  plate: string;
  vendorName: string;
  driverName: string;
  driverCode: string;
  routeName: string | null;
  startKm: number | null;
  endKm: number | null;
  operatingPct: number | null;
  batteryStart: number | null;
  batteryEnd: number | null;
};

export function OperationList({ rows }: { rows: OperationRow[] }) {
  const t = useTranslations();
  const [selected, setSelected] = useState<string | null>(rows[0]?.id ?? null);

  return (
    <div className="p-1.5">
      {rows.map((r) => {
        const noEnd = r.endKm === null;
        return (
          <RecordCard
            key={r.id}
            selected={selected === r.id}
            onSelect={() => setSelected(r.id)}
          >
            <CardTop>
              <Code>{r.code}</Code>
              <Pill tone={noEnd ? "warn" : "go"}>
                {noEnd ? t("status.noEndKm") : t("status.operating")}
              </Pill>
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
              <span className="text-[13.5px]">{r.driverName}</span>
              <Micro bar={false}>{r.driverCode}</Micro>
            </div>

            <div className="mt-2.5">
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
                <Micro tone="go">{r.operatingPct}% operating</Micro>
              </CardFoot>
            )}
          </RecordCard>
        );
      })}
    </div>
  );
}
