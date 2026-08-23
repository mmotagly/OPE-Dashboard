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

/**
 * A hard outer deadline around the *whole* getUser() call, not just the one
 * fetch inside it. getUser() awaits its own initialization first
 * (_initialize -> _recoverAndRefresh in @supabase/auth-js), which — under
 * conditions traced directly in that source — can make more than one
 * internal call before getUser()'s own fetch even runs, each independently
 * bounded by the per-fetch timeout above. That bounds each call; this bounds
 * the total, unconditionally, no matter how many internal calls happen.
 */
const AUTH_DEADLINE_MS = 6000;

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("auth_check_deadline_exceeded")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function updateSession(request: NextRequest) {
  // Tags every log line from this invocation, so a future capture can tell
  // apart one request retrying internally from several separate requests
  // (concurrent tabs, prefetches, a retried navigation) each independently
  // hitting a slow Auth service during the same bad window — the ambiguity
  // that made the last log capture inconclusive.
  const requestId = crypto.randomUUID().slice(0, 8);
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

  // A slow or hung Auth service should never hang middleware itself — a
  // timed-out check falls back to "unauthenticated" rather than propagating
  // the error and failing the whole request.
  //
  // Timed and logged deliberately: the per-fetch AbortSignal alone (still in
  // place above) didn't stop MIDDLEWARE_INVOCATION_TIMEOUT from recurring —
  // logs showed getUser() itself taking the full per-fetch timeout more than
  // once in a row, consistent with @supabase/auth-js making more than one
  // internal call before returning. withDeadline() caps the total regardless.
  // Check Vercel's Logs "Messages" column, grouped by requestId, for timing.
  const authStart = Date.now();
  let user = null;
  try {
    const { data } = await withDeadline(supabase.auth.getUser(), AUTH_DEADLINE_MS);
    user = data.user;
    console.log(`[middleware ${requestId}] getUser resolved in ${Date.now() - authStart}ms`);
  } catch (err) {
    console.log(
      `[middleware ${requestId}] getUser failed after ${Date.now() - authStart}ms:`,
      err instanceof Error ? err.message : err,
    );
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
