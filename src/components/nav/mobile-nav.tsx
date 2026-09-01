"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Sidebar } from "./sidebar";
import type { AppRole } from "@/lib/roles";
import type { CurrentUser } from "@/lib/auth";

/**
 * Below `xl` the sidebar in the shell is hidden and there is no other way to
 * move between modules, so this is the mobile replacement: a hamburger
 * trigger in the topbar that opens the same `Sidebar` content in a sheet
 * sliding in from the start edge, mirroring the record `Drawer`'s geometry
 * (full height under the topbar, same z-40/z-50 scrim-and-panel convention).
 *
 * Root cause of "taps do nothing" (six prior attempts, all passing every
 * programmatic test but failing on real Android Chrome): `backdrop-blur-md`
 * on the topbar's `<header>` makes it the CSS containing block for its
 * `position: fixed` descendants — a real spec rule (backdrop-filter behaves
 * like transform/filter/perspective here). Since the sheet used to render as
 * a DOM child of the header, its `top: 68px` / `bottom: 0` were resolved
 * against the header's own ~68px-tall box, not the viewport — landing
 * exactly on top of each other for a computed height of 0. The click always
 * worked and `open` always flipped to `true`; the sheet was just an
 * invisible sliver. `Drawer` never had this bug because it's never rendered
 * inside the header. Confirmed live via Chrome remote debugging
 * (chrome://inspect) over USB, not guessed.
 *
 * Fix: portal the scrim + sheet straight into `document.body`, escaping the
 * header's containing block entirely.
 */
export function MobileNav({
  role,
  user,
  initialTheme,
  alertCount,
}: {
  role: AppRole;
  user: CurrentUser;
  initialTheme: "light" | "dark";
  alertCount: number;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("closeMenu") : t("openMenu")}
        aria-expanded={open}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] border border-hairline text-ink-2 transition-colors hover:bg-raise hover:text-ink xl:hidden"
      >
        {open ? (
          <span aria-hidden className="text-[15px]">
            ×
          </span>
        ) : (
          <span aria-hidden className="grid gap-[3px]">
            <span className="block h-[1.5px] w-4 bg-current" />
            <span className="block h-[1.5px] w-4 bg-current" />
            <span className="block h-[1.5px] w-4 bg-current" />
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed bottom-0 start-0 end-0 top-[68px] z-40 bg-black/55 xl:hidden"
            />

            <aside
              role="dialog"
              aria-modal="true"
              aria-label={t("openMenu")}
              className="fixed bottom-0 start-0 top-[68px] z-50 flex w-[min(300px,84vw)] flex-col overflow-y-auto border-e border-hairline bg-surface shadow-[0_0_60px_rgb(0_0_0/0.6)] xl:hidden"
            >
              <Sidebar
                role={role}
                user={user}
                variant="mobile"
                onNavigate={() => setOpen(false)}
                initialTheme={initialTheme}
                alertCount={alertCount}
              />
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
