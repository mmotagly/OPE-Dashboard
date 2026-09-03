import { getLocale } from "next-intl/server";
import { requireUser, type AppRole } from "@/lib/auth";
import type { FormState } from "@/lib/forms";

/**
 * Every module's server actions gate on the same shape: resolve the locale,
 * load the current user, reject with a `FormState` if their role isn't
 * allowed. `makeActionGuard` builds that gate once from the module's own
 * `can*` check; `deniedAction` narrows the result back to `FormState` at the
 * call site.
 *
 * Server-only (imports `@/lib/auth`, which reaches `next/headers`) — never
 * import this from `lib/forms.ts` or anything a Client Component pulls in.
 */
export type ActionGuard = { locale: string; role: AppRole };

export function makeActionGuard(allowed: (role: AppRole) => boolean) {
  return async function guard(): Promise<ActionGuard | FormState> {
    const locale = await getLocale();
    const user = await requireUser(locale);
    if (!allowed(user.role)) return { formError: "forbidden", fieldErrors: {} };
    return { locale, role: user.role };
  };
}

export function deniedAction(g: ActionGuard | FormState): g is FormState {
  return "formError" in g;
}
