"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/lib/i18n/routing";

/**
 * Lives in the sidebar footer (both desktop and mobile variants share this
 * component) rather than Settings — Settings is super_admin-only
 * (`notFound()` for everyone else), so it can't be the only place to sign
 * out without locking every other role out of doing so.
 */
export function SignOut({ label, collapsed = false }: { label: string; collapsed?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await createClient().auth.signOut();
          router.replace("/login");
          router.refresh();
        })
      }
      title={collapsed ? label : undefined}
      className={`mt-1.5 flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-nav-item text-ink-2 transition-colors hover:bg-raise disabled:opacity-50 ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
