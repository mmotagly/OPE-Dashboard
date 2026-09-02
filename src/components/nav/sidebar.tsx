"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { canSeeMoney, isSuper, type AppRole } from "@/lib/roles";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitch } from "./locale-switch";
import { SignOut } from "./sign-out";
import {
  CalendarDays,
  BellRing,
  ClipboardList,
  BatteryCharging,
  MapPin,
  Users,
  Wrench,
  ClipboardCheck,
  CalendarClock,
  Bus,
  IdCard,
  Building2,
  Route as RouteIcon,
  Camera,
  LayoutDashboard,
  Award,
  TrendingUp,
  Receipt,
  History,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; count?: number };
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
 * closes the sheet after a link is tapped. Collapse (icons-only, `collapsed`/
 * `onToggleCollapsed`) only applies to the desktop variant — a slide-in
 * sheet has no reason to hide its own labels.
 */
export function Sidebar({
  role,
  user,
  variant = "desktop",
  onNavigate,
  initialTheme,
  alertCount,
  collapsed = false,
  onToggleCollapsed,
}: {
  role: AppRole;
  /** Was topbar-only; moved here (bottom-left, alongside the theme toggle)
   * so the topbar stays a single short row regardless of name/job-title
   * length — a long combination used to be able to wrap the topbar onto a
   * second line, which broke every sticky `top-[68px]` offset in the app
   * (table headers, this component's own desktop sticky position, and
   * MobileNav's sheet) since they all assume a fixed single-row height. */
  user: { fullName: string; jobTitle: string | null };
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  initialTheme: "light" | "dark";
  /** Live due_now/overdue PM + aging RFR count — roadmap item 5's proactive
   * surfacing, visible from any page via the existing nav-item count badge. */
  alertCount: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();

  // next-intl already strips the locale, but a raw `/en/...` is handled too so
  // the highlight never depends on which navigation API got us here.
  const segment = `/${pathname.replace(/^\/(en|ar)(?=\/|$)/, "").split("/")[1] ?? ""}`;

  const groups: Group[] = [
    {
      label: t("operations"),
      items: [
        { href: "/day-board", label: t("dayBoard"), icon: CalendarDays },
        { href: "/operations", label: t("dailyOperations"), icon: ClipboardList },
        { href: "/trips", label: t("trips"), icon: RouteIcon },
        { href: "/charging", label: t("charging"), icon: BatteryCharging },
      ],
    },
    {
      label: t("maintenance"),
      items: [
        { href: "/rfrs", label: t("rfrs"), icon: Wrench },
        { href: "/work-orders", label: t("workOrders"), icon: ClipboardCheck },
        { href: "/periodic-maintenance", label: t("periodicMaintenance"), icon: CalendarClock },
        {
          href: "/alerts",
          label: t("alerts"),
          icon: BellRing,
          count: alertCount > 0 ? alertCount : undefined,
        },
      ],
    },
    {
      label: t("gpsAndCameras"),
      items: [
        { href: "/fleet-location", label: t("fleetLocation"), icon: MapPin },
        { href: "/cameras", label: t("cameras"), icon: Camera },
        { href: "/passenger-counts", label: t("passengerCounts"), icon: Users },
      ],
    },
    {
      // All master data is readable by every role; the write gates live on the
      // pages and in the Server Actions, not here.
      label: t("fleet"),
      items: [
        { href: "/vendors", label: t("vendors"), icon: Building2 },
        { href: "/vehicles", label: t("vehicles"), icon: Bus },
        { href: "/drivers", label: t("drivers"), icon: IdCard },
      ],
    },
  ];

  if (canSeeMoney(role)) {
    groups.push({
      label: t("finance"),
      items: [
        { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
        { href: "/vendor-trends", label: t("vendorTrends"), icon: TrendingUp },
        { href: "/scorecards", label: t("scorecards"), icon: Award },
        { href: "/invoices", label: t("invoices"), icon: Receipt },
      ],
    });
  }

  if (isSuper(role)) {
    groups.push({
      label: t("admin"),
      items: [
        { href: "/activity-log", label: t("activityLog"), icon: History },
        { href: "/settings", label: t("settings"), icon: Settings },
      ],
    });
  }

  const isDesktop = variant === "desktop";
  const isCollapsed = isDesktop && collapsed;

  // Expanded mode's group list gets its own scroll — at a normal ~900px
  // viewport with every group visible (super_admin), the list is genuinely
  // taller than the sidebar's box, and the old plain-overflow layout just
  // let the bottom groups (and the always-should-be-visible user/theme
  // footer) run off the box with no way to reach them. Collapsed mode
  // deliberately does NOT get the same overflow-y: setting it forces the
  // browser to coerce overflow-x to auto too (CSS's own rule), which would
  // permanently clip the collapsed-mode tooltip below — it escapes the
  // list's box horizontally by design. Collapsed content measures shorter
  // than expanded (no group-label rows), and doesn't overflow at any
  // reasonable desktop viewport height, so it keeps the simpler
  // fully-visible layout instead.
  const navClass = isDesktop
    ? "flex h-full flex-col rounded-[14px] bg-surface px-2.5 py-3.5 rim"
    : "px-2.5 py-3.5";
  const listClass = isDesktop
    ? isCollapsed
      ? "min-h-0"
      : "min-h-0 flex-1 overflow-y-auto"
    : "";

  return (
    <nav className={navClass}>
      {isDesktop && onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={isCollapsed ? t("expandSidebar") : t("collapseSidebar")}
          title={isCollapsed ? t("expandSidebar") : t("collapseSidebar")}
          className={`mb-2 flex shrink-0 items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-ink-3 transition-colors hover:bg-raise hover:text-ink ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
          )}
        </button>
      )}

      <div className={listClass}>
        {groups.map((g) => (
          <div key={g.label}>
            {!isCollapsed && (
              <p className="px-2.5 pb-1.5 pt-3.5 text-section-label font-medium uppercase tracking-[0.04em] text-ink-3">
                {g.label}
              </p>
            )}
            {isCollapsed && <div className="mt-3.5 border-t border-hairline pt-1.5" />}
            {g.items.map((item) => {
            // Segment match, not prefix match: /operations?mode=new stays
            // highlighted, and /routes never lights up /rfrs.
            const isActive = segment === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-nav-item transition-colors ${
                  isCollapsed ? "justify-center" : ""
                } ${isActive ? "bg-accent-bg font-medium text-accent" : "text-ink-2 hover:bg-raise"}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!isCollapsed && <span>{item.label}</span>}
                {!isCollapsed && item.count !== undefined && (
                  <span className="tnum ms-auto rounded-full bg-idle px-1.5 py-px text-[10.5px] font-semibold text-ink-2">
                    {item.count}
                  </span>
                )}
                {isCollapsed && item.count !== undefined && (
                  <span
                    aria-hidden
                    className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warn"
                  />
                )}
                {/* Tooltip: collapsed mode only, CSS-only (no JS/portal —
                    z-30 keeps it under the topbar/drawer, above page
                    content). */}
                {isCollapsed && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute start-full top-1/2 z-30 ms-2 -translate-y-1/2 whitespace-nowrap rounded-[7px] bg-elev px-2 py-1 text-[11.5px] font-medium text-ink opacity-0 shadow-[0_4px_16px_rgb(0_0_0/0.4)] transition-opacity group-hover:opacity-100"
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3.5 shrink-0 border-t border-hairline pt-1.5">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight">{user.fullName}</p>
              <p className="truncate text-[11px] text-ink-3">{user.jobTitle ?? role}</p>
            </div>
            <LocaleSwitch />
          </div>
        )}
        <ThemeToggle initialTheme={initialTheme} collapsed={isCollapsed} />
        <SignOut label={tCommon("signOut")} collapsed={isCollapsed} />
      </div>
    </nav>
  );
}
