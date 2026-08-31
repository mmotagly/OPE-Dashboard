import { NextRequest, NextResponse } from "next/server";
import { activeGpsAdapter } from "@/lib/gps/adapters";
import { ingestPings } from "@/lib/gps/ingest";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Pull-model ingestion (ROADMAP_NEXT.md item 2's "polling job if it only
 * exposes a pull API") — the alternative to the webhook route, for
 * whichever pattern the chosen provider actually needs. Meant to be hit on
 * a schedule (Vercel Cron, `vercel.json`'s `crons` array — not configured
 * yet, since there's no real provider to poll) rather than by a person, so
 * it's gated by CRON_SECRET the same way Vercel's own cron docs recommend,
 * not app auth.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adapter = activeGpsAdapter();
  if (!adapter) {
    return NextResponse.json({ error: "GPS_PROVIDER is not configured" }, { status: 503 });
  }
  if (!adapter.poll) {
    return NextResponse.json(
      { error: `${adapter.provider} adapter does not implement polling` },
      { status: 501 },
    );
  }
  if (!adapter.isConfigured()) {
    return NextResponse.json(
      { error: `${adapter.provider} adapter is not configured` },
      { status: 503 },
    );
  }

  const supabase = createServiceClient();
  // vehicle_gps_pings isn't in the generated types yet — its migration
  // hasn't run. Same one-line bridge as csv-import.ts's loadCodeMap, to be
  // removed once `npx supabase gen types` picks the table up.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latest } = await (supabase as any)
    .from("vehicle_gps_pings")
    .select("recorded_at")
    .eq("provider", adapter.provider)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // First-ever poll for this provider: look back an hour rather than
  // pulling full history, which the provider's API may not even support.
  const sinceIso = latest?.recorded_at ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const pings = await adapter.poll(sinceIso);
    const inserted = await ingestPings(adapter.provider, pings);
    return NextResponse.json({ inserted, sinceIso });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Poll failed" },
      { status: 500 },
    );
  }
}
