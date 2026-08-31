import { NextRequest, NextResponse } from "next/server";
import { activeGpsAdapter } from "@/lib/gps/adapters";
import { ingestPings } from "@/lib/gps/ingest";

/**
 * Push-model ingestion (ROADMAP_NEXT.md item 2's "webhook receiver if the
 * provider pushes data"). Whichever provider ends up wired in would point
 * its webhook config at this URL.
 *
 * Auth is a shared secret in a header, not Supabase auth — the caller is
 * the GPS provider's server, not a logged-in app user. GPS_WEBHOOK_SECRET
 * is a config slot: unset until the user has a value to put there, and
 * every request is rejected until it's set (fails closed, not open).
 */
export async function POST(request: NextRequest) {
  const expected = process.env.GPS_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "GPS_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("x-webhook-secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adapter = activeGpsAdapter();
  if (!adapter) {
    return NextResponse.json(
      { error: "GPS_PROVIDER is not configured" },
      { status: 503 },
    );
  }
  if (!adapter.normalizeWebhookPayload) {
    return NextResponse.json(
      { error: `${adapter.provider} adapter does not implement webhook ingestion` },
      { status: 501 },
    );
  }
  if (!adapter.isConfigured()) {
    return NextResponse.json(
      { error: `${adapter.provider} adapter is not configured` },
      { status: 503 },
    );
  }

  const body = await request.json();

  try {
    const pings = adapter.normalizeWebhookPayload(body);
    const inserted = await ingestPings(adapter.provider, pings);
    return NextResponse.json({ inserted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingestion failed" },
      { status: 500 },
    );
  }
}
