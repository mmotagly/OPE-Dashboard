import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";

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

  return (
    <>
      <Topbar user={user} initialTheme={initialTheme} />
      <div className="grid items-start gap-3.5 px-5 pb-7 pt-3.5 xl:grid-cols-[232px_minmax(0,1fr)]">
        <div className="hidden xl:block">
          <Sidebar role={user.role} initialTheme={initialTheme} />
        </div>
        {children}
      </div>
    </>
  );
}
