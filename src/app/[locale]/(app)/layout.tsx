import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/nav/app-shell";
import { Topbar } from "@/components/nav/topbar";
import { loadAlertCounts } from "./alerts/queries";

/**
 * Two regions: the nav tree and the content, which takes everything else.
 * There is no record-list column — list pages are full-width tables and the
 * detail drawer overlays them rather than taking a third column.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  const initialCollapsed = cookieStore.get("sidebarCollapsed")?.value === "true";
  // Proactive surfacing (roadmap item 5) — visible from any page, not just
  // when a user opens /alerts. A courtesy badge: loadAlertCounts() never
  // throws, so a failed count just shows no badge rather than blocking the
  // page.
  const alertCount = await loadAlertCounts();

  return (
    <>
      <Topbar user={user} initialTheme={initialTheme} alertCount={alertCount} />
      <AppShell
        role={user.role}
        user={user}
        initialTheme={initialTheme}
        alertCount={alertCount}
        initialCollapsed={initialCollapsed}
      >
        {children}
      </AppShell>
    </>
  );
}
