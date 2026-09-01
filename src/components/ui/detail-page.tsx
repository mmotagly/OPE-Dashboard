import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";
import { Panel } from "./panel";

/**
 * The standalone full-page counterpart to `Drawer` — same code/pill/sub
 * header shape, but flows as an ordinary page (via `Panel`) instead of a
 * fixed overlay, with a back link instead of a scrim/close-X. Reached by
 * clicking a record's code/ID specifically (row clicks elsewhere still open
 * `Drawer`, unchanged) — see CLAUDE.md's row-click-vs-code-link convention.
 * A module's `*DetailBody` content component (already factored out of its
 * drawer) is the one thing shared between the two; this and `Drawer` are
 * deliberately two separate, simple chrome components rather than one
 * component branching on a "mode" — the overlay's fixed-position/scrim
 * mechanics and this one's plain page flow don't share enough to be worth
 * unifying.
 */
export function DetailPage({
  code,
  sub,
  pill,
  backHref,
  backLabel,
  actions,
  children,
}: {
  code: ReactNode;
  sub?: ReactNode;
  pill?: ReactNode;
  backHref: string;
  backLabel: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel clip={false}>
      <header className="border-b border-hairline px-4 py-3.5">
        <Link href={backHref} className="text-[12px] text-ink-3 transition-colors hover:text-ink-2">
          ← {backLabel}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <span className="tnum text-2xl font-semibold tracking-[-0.02em]">{code}</span>
          {pill}
          {actions && <div className="ms-auto flex flex-wrap gap-2.5">{actions}</div>}
        </div>
        {sub && <p className="mt-1 text-[12.5px] text-ink-3">{sub}</p>}
      </header>
      {children}
    </Panel>
  );
}
