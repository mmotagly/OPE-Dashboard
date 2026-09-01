"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import type { AppRole } from "@/lib/roles";

/**
 * The desktop two-column grid, split out as its own small client island so
 * the collapse toggle can change the sidebar's column width without making
 * the whole app layout a Client Component. Same cookie-based persistence
 * pattern as ThemeToggle — a per-device display preference, not application
 * data, so it doesn't belong in the database (CLAUDE.md's no-localStorage
 * rule isn't about cookies, but the spirit — durable per-device UI state —
 * still argues for the same mechanism already used for theme).
 */
export function AppShell({
  role,
  user,
  initialTheme,
  alertCount,
  initialCollapsed,
  children,
}: {
  role: AppRole;
  user: { fullName: string; jobTitle: string | null };
  initialTheme: "light" | "dark";
  alertCount: number;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebarCollapsed=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div
      className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3.5 px-5 pb-7 pt-3.5 ${
        collapsed ? "xl:grid-cols-[64px_minmax(0,1fr)]" : "xl:grid-cols-[232px_minmax(0,1fr)]"
      }`}
    >
      <div className="hidden min-h-0 xl:block">
        <Sidebar
          role={role}
          user={user}
          initialTheme={initialTheme}
          alertCount={alertCount}
          collapsed={collapsed}
          onToggleCollapsed={toggle}
        />
      </div>
      {/* The one contained scrollbar for page content — sidebar and topbar
          sit outside it entirely, so they cannot move regardless of what's
          inside. Pages whose Panel uses `fill` occupy exactly this height,
          so their own internal table scroll takes over and this outer
          scroll never engages; pages that stack several panels (Dashboard,
          Vendor trends, Alerts, Day board) scroll here instead. */}
      <div className="min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
