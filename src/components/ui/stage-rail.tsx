"use client";

export type StageState = "done" | "now" | "skip" | "todo";

export type Stage = {
  code: string;
  label: string;
  state: StageState;
};

/**
 * Horizontal rail of RFR stages. Completed segments are ink, the current stage
 * is a green node with a soft halo, skipped stages are struck through.
 *
 * Read-only by default. Passing `onSelect` makes valid-target nodes (those in
 * `clickable`) into tap targets — the armed one (`armedCode`) gets a ring,
 * signalling "tap again to confirm" without a separate button or modal.
 */
export function StageRail({
  stages,
  onSelect,
  clickable,
  armedCode,
}: {
  stages: Stage[];
  onSelect?: (code: string) => void;
  /** Codes that are valid transition targets from the current stage right now. */
  clickable?: Set<string>;
  /** The code armed by a first tap, awaiting a confirming second tap. */
  armedCode?: string | null;
}) {
  return (
    <ol className="flex items-start">
      {stages.map((s, i) => {
        const filled = s.state === "done" || s.state === "now";
        const isClickable =
          Boolean(onSelect) && s.state !== "now" && Boolean(clickable?.has(s.code));
        const isArmed = armedCode === s.code;

        const dot = (
          <span
            aria-hidden
            className={`relative z-[2] mx-auto mb-2 block h-[11px] w-[11px] rounded-full ${
              s.state === "done"
                ? "bg-ink"
                : s.state === "now"
                  ? "bg-go shadow-[0_0_0_4px_var(--color-go-soft)]"
                  : "bg-idle"
            } ${isArmed ? "shadow-[0_0_0_3px_var(--color-ink-2)]" : ""}`}
          />
        );

        const label = (
          <span
            className={`block break-words text-[9.5px] font-semibold uppercase leading-tight tracking-[0.05em] ${
              filled ? "text-ink" : isClickable ? "text-ink-2" : "text-ink-3"
            } ${s.state === "skip" ? "line-through" : ""}`}
          >
            {s.label}
          </span>
        );

        return (
          <li key={s.code} className="relative min-w-0 flex-1 text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-[5px] h-[1.5px] w-full ${filled ? "bg-ink" : "bg-hairline"}`}
                style={{ insetInlineStart: "-50%" }}
              />
            )}
            {isClickable ? (
              <button
                type="button"
                onClick={() => onSelect?.(s.code)}
                aria-pressed={isArmed}
                className="block w-full cursor-pointer"
              >
                {dot}
                {label}
              </button>
            ) : (
              <>
                {dot}
                {label}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
