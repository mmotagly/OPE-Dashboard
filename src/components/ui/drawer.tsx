import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";
import { DrawerDismiss } from "./drawer-dismiss";
import type { QueryParams } from "@/lib/filters";

export type CloseHref = { pathname: string; query: QueryParams };

/**
 * The one drawer. Viewing, creating and editing a record all use it, driven by
 * the URL (`?id=`, `?mode=new`, `?mode=edit&id=`) so it stays a Server
 * Component.
 *
 * It overlays the table from the inline-end edge rather than taking a column,
 * so the clicked row stays visible behind the scrim. Below `xl` — where the
 * shell stops being two regions — it becomes a full-screen sheet.
 *
 * Structure is fixed across modules: header with code and status, scrollable
 * body, pinned footer with the primary action first.
 */
export function Drawer({
  code,
  sub,
  pill,
  closeHref,
  closeLabel,
  footer,
  children,
}: {
  code: ReactNode;
  sub?: ReactNode;
  pill?: ReactNode;
  closeHref: CloseHref;
  closeLabel: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {/* Scrim. Only at xl — below that the sheet covers the viewport anyway. */}
      <Link
        href={closeHref}
        aria-hidden
        tabIndex={-1}
        className="fixed bottom-0 start-0 end-0 top-[68px] z-40 hidden bg-black/55 xl:block"
      />

      <DrawerDismiss href={closeHref} />

      <aside
        className="fixed bottom-0 start-0 end-0 top-0 z-50 flex flex-col bg-surface shadow-[0_0_60px_rgb(0_0_0/0.6)] xl:top-[68px] xl:start-auto xl:w-[min(560px,92vw)] xl:border-s xl:border-hairline"
        aria-label={closeLabel}
      >
        {/*
          Header and footer are shrink-0: they size to their content and the
          body absorbs whatever is left. Without it a tall body compresses them
          and the footer's action gets clipped at the bottom edge.
        */}
        <header className="flex shrink-0 items-start gap-2.5 border-b border-hairline px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="tnum text-lg font-semibold tracking-[-0.02em]">
                {code}
              </span>
              {pill}
            </div>
            {sub && <p className="mt-1 text-[12.5px] text-ink-3">{sub}</p>}
          </div>

          <Link
            href={closeHref}
            aria-label={closeLabel}
            className="ms-auto grid h-8 w-8 shrink-0 place-items-center rounded-control border border-hairline text-[15px] text-ink-2 transition-colors hover:bg-raise hover:text-ink"
          >
            ×
          </Link>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <footer className="flex shrink-0 flex-wrap gap-2.5 border-t border-hairline bg-surface px-4 py-3.5">
            {footer}
          </footer>
        )}
      </aside>
    </>
  );
}
