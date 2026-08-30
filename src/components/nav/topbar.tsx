import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "./locale-switch";
import { SignOut } from "./sign-out";
import { MobileNav } from "./mobile-nav";
import type { CurrentUser } from "@/lib/auth";

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
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-2 overscroll-x-none border-b border-hairline bg-canvas/85 px-5 py-3 backdrop-blur-md sm:gap-4">
      <MobileNav role={user.role} initialTheme={initialTheme} alertCount={alertCount} />

      <div className="flex items-center gap-2.5 font-semibold tracking-[-0.01em]">
        <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-lg bg-accent-fill text-[12px] font-bold text-on-accent">
          P
        </span>
        <span className="hidden sm:inline">{t("brand")}</span>
      </div>

      <div className="flex-1" />

      <div className="hidden text-end sm:block">
        <p className="text-[13px] font-medium leading-tight">{user.fullName}</p>
        <p className="text-[11px] text-ink-3">{user.jobTitle ?? user.role}</p>
      </div>
      <LocaleSwitch />
      <SignOut label={t("common.signOut")} />
    </header>
  );
}
