"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { canSeeMoney, isSuper, type AppRole } from "@/lib/roles";
import { ThemeToggle } from "./theme-toggle";

type Item = { href: string; label: string; count?: number };
type Group = { label: string; items: Item[] };

/**
 * Role-aware nav tree. A role that cannot use a section never sees it —
 * hiding beats showing-then-erroring.
 *
 * Client-side because the active item comes from the pathname, which a Server
 * Component cannot read.
 *
 * Also the content of the mobile nav sheet (`MobileNav`) below `xl`, where
 * `variant="mobile"` drops the desktop sticky/card chrome and `onNavigate`
 * closes the sheet after a link is tapped.
 */
export function Sidebar({
  role,
  variant = "desktop",
  onNavigate,
  initialTheme,
}: {
  role: AppRole;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  initialTheme: "light" | "dark";
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  // next-intl already strips the locale, but a raw `/en/...` is handled too so
  // the highlight never depends on which navigation API got us here.
  const segment = `/${pathname.replace(/^\/(en|ar)(?=\/|$)/, "").split("/")[1] ?? ""}`;

  const groups: Group[] = [
    {
      label: t("overview"),
      items: [
        { href: "/day-board", label: t("dayBoard") },
        { href: "/alerts", label: t("alerts") },
      ],
    },
    {
      label: t("operations"),
      items: [
        { href: "/operations", label: t("dailyOperations") },
        { href: "/charging", label: t("charging") },
      ],
    },
    {
      label: t("maintenance"),
      items: [
        { href: "/rfrs", label: t("rfrs") },
        { href: "/work-orders", label: t("workOrders") },
        { href: "/periodic-maintenance", label: t("periodicMaintenance") },
      ],
    },
    {
      // All master data is readable by every role; the write gates live on the
      // pages and in the Server Actions, not here.
      label: t("fleet"),
      items: [
        { href: "/vehicles", label: t("vehicles") },
        { href: "/drivers", label: t("drivers") },
        { href: "/vendors", label: t("vendors") },
        { href: "/routes", label: t("routes") },
      ],
    },
  ];

  if (canSeeMoney(role)) {
    groups.push({
      label: t("finance"),
      items: [
        { href: "/dashboard", label: t("dashboard") },
        { href: "/scorecards", label: t("scorecards") },
        { href: "/invoices", label: t("invoices") },
      ],
    });
  }

  if (isSuper(role)) {
    groups.push({
      label: t("admin"),
      items: [
        { href: "/activity-log", label: t("activityLog") },
        { href: "/settings", label: t("settings") },
      ],
    });
  }

  const navClass =
    variant === "desktop"
      ? "sticky top-[68px] rounded-[14px] bg-surface px-2.5 py-3.5 rim"
      : "px-2.5 py-3.5";

  return (
    <nav className={navClass}>
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-2.5 pb-1.5 pt-3.5 text-section-label font-medium uppercase tracking-[0.04em] text-ink-3">
            {g.label}
          </p>
          {g.items.map((item) => {
            // Segment match, not prefix match: /operations?mode=new stays
            // highlighted, and /routes never lights up /rfrs.
            const isActive = segment === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-nav-item transition-colors ${
                  isActive
                    ? "bg-accent-bg font-medium text-accent"
                    : "text-ink-2 hover:bg-raise"
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="tnum ms-auto rounded-full bg-idle px-1.5 py-px text-[10.5px] font-semibold text-ink-2">
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-3.5 border-t border-hairline pt-1.5">
        <ThemeToggle initialTheme={initialTheme} />
      </div>
    </nav>
  );
}
