import { getTranslations } from "next-intl/server";
import { MobileNav } from "./mobile-nav";
import type { CurrentUser } from "@/lib/auth";

/**
 * Deliberately minimal: user name, job title, language toggle, and sign out
 * all live in the sidebar's bottom-left instead (SignOut specifically
 * because Settings — where it was asked to go — is super_admin-only, so it
 * can't be the only way to sign out). What's left here is just the brand
 * and the mobile hamburger.
 */
export async function Topbar({
  user,
  initialTheme,
  alertCount,
}: {
  user: CurrentUser;
  initialTheme: "light" | "dark";
  alertCount: number;
}) {
  const t = await getTranslations();

  return (
    <header className="z-40 flex shrink-0 flex-nowrap items-center gap-2 overscroll-x-none border-b border-hairline bg-canvas/85 px-5 py-3 backdrop-blur-md sm:gap-4">
      <MobileNav role={user.role} user={user} initialTheme={initialTheme} alertCount={alertCount} />

      <div className="flex items-center gap-2.5 font-semibold tracking-[-0.01em]">
        <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg bg-accent-fill text-[12px] font-bold text-on-accent">
          P
        </span>
        <span className="hidden sm:inline">{t("brand")}</span>
      </div>
    </header>
  );
}
