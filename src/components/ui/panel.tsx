import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  clip = true,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Panels clip their content to the card radius. A panel holding a table sets
   * this false: `overflow: hidden` makes the panel the scrollport, and a sticky
   * table header would then stick to a container that never scrolls.
   */
  clip?: boolean;
}) {
  return (
    <section
      className={`${clip ? "overflow-hidden" : ""} rounded-card bg-surface rim ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHead({
  eyebrow,
  title,
  actions,
}: {
  /** Muted breadcrumb sitting above the title — DESIGN_SYSTEM.md's page header. */
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-eyebrow text-ink-3">{eyebrow}</p>
        )}
        <h2 className="text-page-title font-semibold tracking-[-0.01em]">{title}</h2>
      </div>
      {actions && (
        <div className="ms-auto flex gap-3.5 text-xs text-ink-3">{actions}</div>
      )}
    </header>
  );
}

/**
 * Header of a detail pane: the record's code at display size, its status pill,
 * and whatever action the role is allowed (usually Edit).
 */
export function DetailHead({
  code,
  sub,
  pill,
  actions,
}: {
  code: ReactNode;
  sub?: ReactNode;
  pill?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="px-4 pb-3.5 pt-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="tnum text-2xl font-semibold tracking-[-0.02em]">{code}</span>
        {pill}
        {actions && <div className="ms-auto flex items-center gap-2.5">{actions}</div>}
      </div>
      {sub && <p className="mt-1.5 text-[12.5px] text-ink-3">{sub}</p>}
    </header>
  );
}

export function Section({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-hairline px-4 py-4">
      {title && (
        <h3 className="mb-3 text-section-label font-medium uppercase tracking-[0.04em] text-ink-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
