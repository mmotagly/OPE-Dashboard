import { km } from "@/lib/format";
import { Micro } from "./micro";

type Props = {
  startKm: number | null;
  endKm: number | null;
  /** 0–100. How far through the current PM interval this vehicle is. */
  pmProgress?: number | null;
  pmLabel?: string;
  pmTone?: "neutral" | "warn" | "stop";
  right?: string;
  large?: boolean;
};

const FILL = {
  neutral: "bg-ink",
  warn: "bg-warn",
  stop: "bg-stop",
} as const;

/**
 * Signature element. Start → end odometer with distance covered, and a bar
 * showing progress toward the nearest due periodic maintenance item.
 */
export function KmMeter({
  startKm,
  endKm,
  pmProgress,
  pmLabel,
  pmTone = "neutral",
  right,
  large = false,
}: Props) {
  const distance = startKm !== null && endKm !== null ? endKm - startKm : null;

  return (
    <div>
      <div
        className={`flex flex-wrap items-baseline gap-2 tnum font-medium ${large ? "text-lg" : "text-sm"}`}
      >
        <span>{km(startKm)}</span>
        <span className="text-ink-3 font-normal">→</span>
        <span className={endKm === null ? "text-ink-3" : ""}>{km(endKm)}</span>
        <span
          className={`ms-auto text-xs font-medium ${distance === null ? "text-warn-text" : "text-ink-2"}`}
        >
          {distance === null ? "pending" : `${km(distance)} km`}
        </span>
      </div>

      {pmProgress !== null && pmProgress !== undefined && (
        <div className={`mt-2 overflow-hidden rounded-sm bg-idle ${large ? "h-1.5" : "h-1"}`}>
          <div
            className={`h-full rounded-sm ${FILL[pmTone]}`}
            style={{ width: `${Math.min(100, Math.max(0, pmProgress))}%` }}
          />
        </div>
      )}

      {(pmLabel || right) && (
        <div className="mt-1.5 flex justify-between gap-2.5">
          {pmLabel && (
            <Micro tone={pmTone === "neutral" ? "neutral" : pmTone} bar={false}>
              {pmLabel}
            </Micro>
          )}
          {right && (
            <Micro bar={false}>{right}</Micro>
          )}
        </div>
      )}
    </div>
  );
}
