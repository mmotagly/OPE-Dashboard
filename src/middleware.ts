import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

/** Routes & Stations was renamed to Trips (2026-09) — /routes is gone, but
 * old bookmarks/links shouldn't just 404. Matched on the already
 * locale-prefixed path so it runs correctly regardless of locale; a bare
 * `/routes` with no locale prefix still resolves in two hops (next-intl's
 * own middleware redirects that to `/en/routes` first, which this then
 * catches on the follow-up request). */
const OLD_ROUTES_PATH = /^\/(en|ar)\/routes(\/.*)?$/;

export async function middleware(request: NextRequest) {
  const authResponse = await updateSession(request);
  if (authResponse.headers.get("location")) return authResponse;

  const oldRoutesMatch = request.nextUrl.pathname.match(OLD_ROUTES_PATH);
  if (oldRoutesMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/${oldRoutesMatch[1]}/trips${oldRoutesMatch[2] ?? ""}`;
    return NextResponse.redirect(url);
  }

  const response = intl(request);
  authResponse.cookies.getAll().forEach(({ name, value }) => {
    response.cookies.set(name, value);
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
