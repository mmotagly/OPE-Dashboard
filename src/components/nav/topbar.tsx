import { getTranslations } from "next-intl/server";
import { SignOut } from "./sign-out";
import { MobileNav } from "./mobile-nav";
import type { CurrentUser } from "@/lib/auth";

/**
 * Deliberately short and never wraps to a second line: user name, job
 * title, and the language toggle used to live here and moved to the
 * sidebar's bottom-left (variable-length name/title text was the one
 * thing that could push this row past its assumed ~68px height, and every
 * sticky `top-[68px]` offset in the app — table headers, the sidebar's own
 * sticky position, MobileNav's sheet — depends on that height staying
 * fixed). What's left (brand + sign out, plus the mobile hamburger) is
 * short enough at any supported viewport width that it shouldn't wrap.
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
    <header className="sticky top-0 z-40 flex flex-nowrap items-center gap-2 overscroll-x-none border-b border-hairline bg-canvas/85 px-5 py-3 backdrop-blur-md sm:gap-4">
      <MobileNav role={user.role} user={user} initialTheme={initialTheme} alertCount={alertCount} />

      <div className="flex items-center gap-2.5 font-semibold tracking-[-0.01em]">
        <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg bg-accent-fill text-[12px] font-bold text-on-accent">
          P
        </span>
        <span className="hidden sm:inline">{t("brand")}</span>
      </div>

      <div className="flex-1" />

      <SignOut label={t("common.signOut")} />
    </header>
  );
}
