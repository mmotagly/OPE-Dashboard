import type { ReactNode } from "react";

export type Tone = "go" | "warn" | "stop" | "idle" | "ghost";

/** Semantic tinted pairs — never brand accent (DESIGN_SYSTEM.md). */
const TONE: Record<Tone, string> = {
  go: "bg-go-soft text-go-text",
  warn: "bg-warn-soft text-warn-text",
  stop: "bg-stop-soft text-stop-text",
  idle: "bg-idle text-ink-2",
  ghost: "bg-idle text-ink-2",
};

/** Small uppercase status pill. The only saturated element on screen. */
export function Pill({
  tone = "idle",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] whitespace-nowrap ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
