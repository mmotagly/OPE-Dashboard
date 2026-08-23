import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/auth"];

/**
 * Vercel's own guidance for MIDDLEWARE_INVOCATION_TIMEOUT: an external call
 * with no timeout can hang the whole function until Vercel kills it at 25s.
 * Middleware's only external call is the Supabase Auth session check below —
 * this bounds it well under that ceiling, with a safe fallback rather than a
 * hang: a timed-out check is treated as unauthenticated, same as a genuinely
 * missing session, redirecting to login instead of a dead 504.
 */
const AUTH_TIMEOUT_MS = 5000;

const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) });

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Annotated rather than inlined: createServerClient is overloaded and the
  // deprecated get/set/remove overload is tried first, so an inline literal
  // leaves setAll's parameter implicitly any.
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(list) {
      list.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      list.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
    },
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods, global: { fetch: fetchWithTimeout } },
  );

  // A slow or hung Auth service should never hang middleware itself — an
  // aborted/timed-out check falls back to "unauthenticated" rather than
  // propagating the abort error and failing the whole request.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;
  const stripped = path.replace(/^\/(en|ar)/, "") || "/";
  const isPublic = PUBLIC.some((p) => stripped.startsWith(p));

  if (!user && !isPublic) {
    const locale = path.startsWith("/ar") ? "ar" : "en";
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", stripped);
    return NextResponse.redirect(url);
  }

  return response;
}
