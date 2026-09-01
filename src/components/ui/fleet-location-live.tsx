"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FleetLocationMapLoader } from "./fleet-location-map-loader";
import { FleetLocationTable } from "@/app/[locale]/(app)/fleet-location/fleet-location-table";
import type { FleetLocationRow } from "@/app/[locale]/(app)/fleet-location/queries";

/**
 * Owns the one live `rows` state both the map and the table read from —
 * previously each had its own copy (the table's was frozen at page load,
 * the map's own polling loop was the only thing that ever moved), which is
 * why they used to show different speeds for the same vehicle.
 *
 * Realtime, not polling: a Supabase subscription on `vehicle_gps_pings`
 * inserts updates the instant a ping is written, rather than waiting up to
 * a fixed poll interval on top of the phone's own (unsynchronized) ping
 * interval — those two compounding was the real cause of "feels laggier
 * than 10s/7s alone would suggest." Requires migration 0022
 * (`alter publication supabase_realtime add table vehicle_gps_pings`) to
 * have been run — until then this subscribes successfully but simply
 * never receives an event.
 *
 * Only position/speed/ignition/timestamp come from the subscription — a
 * ping row doesn't carry vehicle code/plate/vendor, so those stay as
 * fetched once at page load (they don't change).
 */
export function FleetLocationLive({ initialRows }: { initialRows: FleetLocationRow[] }) {
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("vehicle_gps_pings-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vehicle_gps_pings" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = payload.new as any;
          console.log("[fleet-location] realtime insert received", p);
          setRows((prev) =>
            prev.map((r) =>
              r.id === p.vehicle_id
                ? {
                    ...r,
                    latitude: p.latitude,
                    longitude: p.longitude,
                    speedKmh: p.speed_kmh,
                    ignitionOn: p.ignition_on,
                    recordedAt: p.recorded_at,
                    provider: p.provider,
                  }
                : r,
            ),
          );
        },
      )
      // Diagnostic logging — a channel that fails to connect or gets
      // rejected by RLS fails *silently* by default (no thrown error, no
      // console output), which is exactly what made this impossible to
      // debug without visibility into the actual subscribe status.
      .subscribe((status, err) => {
        console.log("[fleet-location] realtime subscribe status:", status, err ?? "");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <div className="shrink-0 border-b border-hairline p-3">
        <FleetLocationMapLoader rows={rows} />
      </div>
      <FleetLocationTable rows={rows} />
    </>
  );
}
