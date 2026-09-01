"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import L from "leaflet";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2 } from "lucide-react";
import { busIcon, DARK_TILE_URL, DARK_TILE_ATTRIBUTION } from "./vehicle-map";
import type { FleetLocationRow } from "@/app/[locale]/(app)/fleet-location/queries";

const POLL_MS = 7_000;
const ANIMATE_MS = 900;
/** Pyramids of Giza — fallback center when no vehicle has a position yet. */
const GIZA_FALLBACK: [number, number] = [29.9792, 31.1342];

function tooltipText(r: FleetLocationRow): string {
  return r.speedKmh !== null ? `${r.vehicleCode} · ${r.speedKmh} km/h` : r.vehicleCode;
}

/**
 * Imperative marker layer (not react-leaflet's declarative `<Marker>`) so a
 * position update can be animated — react-leaflet re-rendering a `<Marker>`
 * with a new `position` just calls `setLatLng` instantly, no interpolation.
 * This is what actually reads as "smooth" on screen; it does not change how
 * often new data arrives (that's the ping interval, a phone-side setting).
 */
function LiveMarkers({ rows }: { rows: FleetLocationRow[] }) {
  const map = useMap();
  const markers = useRef(new Map<string, LeafletMarker>());
  const frames = useRef(new Map<string, number>());

  useEffect(() => {
    const seen = new Set<string>();

    for (const r of rows) {
      if (r.latitude === null || r.longitude === null) continue;
      seen.add(r.id);

      const tone = r.ignitionOn ? "go" : "idle";
      const target: [number, number] = [r.latitude, r.longitude];
      const existing = markers.current.get(r.id);

      if (!existing) {
        const marker = L.marker(target, { icon: busIcon(tone) }).addTo(map);
        marker.bindTooltip(tooltipText(r), { direction: "top", offset: [0, -14] });
        markers.current.set(r.id, marker);
        continue;
      }

      existing.setIcon(busIcon(tone));
      existing.setTooltipContent(tooltipText(r));

      const from = existing.getLatLng();
      if (from.lat === target[0] && from.lng === target[1]) continue;

      const previousFrame = frames.current.get(r.id);
      if (previousFrame) cancelAnimationFrame(previousFrame);
      const start = performance.now();
      const fromLatLng: [number, number] = [from.lat, from.lng];
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ANIMATE_MS);
        existing.setLatLng([
          fromLatLng[0] + (target[0] - fromLatLng[0]) * t,
          fromLatLng[1] + (target[1] - fromLatLng[1]) * t,
        ]);
        if (t < 1) {
          frames.current.set(r.id, requestAnimationFrame(step));
        } else {
          frames.current.delete(r.id);
        }
      };
      frames.current.set(r.id, requestAnimationFrame(step));
    }

    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        map.removeLayer(marker);
        markers.current.delete(id);
      }
    }
  }, [rows, map]);

  // Unmount cleanup — the effect above already removes stale markers per
  // update, but not on the component's own teardown (fullscreen toggle
  // remounts the whole MapContainer, per Leaflet's own requirement).
  useEffect(() => {
    const ownMarkers = markers.current;
    const ownFrames = frames.current;
    return () => {
      for (const frame of ownFrames.values()) cancelAnimationFrame(frame);
      for (const marker of ownMarkers.values()) map.removeLayer(marker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function FleetLocationMap({ initialRows }: { initialRows: FleetLocationRow[] }) {
  const t = useTranslations("fleetLocation");
  const [rows, setRows] = useState(initialRows);
  const [fullscreen, setFullscreen] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const hasFramedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/gps/fleet-positions", { cache: "no-store" });
        if (!res.ok) return;
        setRows(await res.json());
      } catch {
        // Transient network blip — keep showing the last good positions
        // rather than clearing the map.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Leaflet measures its container's pixel size on creation; toggling
  // fullscreen resizes that container after the fact, so it needs an
  // explicit nudge once the new layout has actually settled.
  useEffect(() => {
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 50);
    return () => clearTimeout(id);
  }, [fullscreen]);

  const withPosition = rows.filter(
    (r): r is FleetLocationRow & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null,
  );

  // Frame every vehicle once, the first time any position exists — not on
  // every poll, or the view would keep yanking itself away from wherever
  // the user just panned/zoomed to look at one bus.
  useEffect(() => {
    if (hasFramedRef.current || withPosition.length === 0 || !mapRef.current) return;
    hasFramedRef.current = true;
    if (withPosition.length === 1) {
      mapRef.current.setView([withPosition[0].latitude, withPosition[0].longitude], 15);
    } else {
      mapRef.current.fitBounds(
        withPosition.map((r) => [r.latitude, r.longitude]),
        { padding: [32, 32] },
      );
    }
  }, [withPosition]);

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-canvas p-3" : "relative"}>
      <MapContainer
        ref={mapRef}
        center={GIZA_FALLBACK}
        zoom={13}
        scrollWheelZoom={fullscreen}
        style={{ height: fullscreen ? "100%" : 320, width: "100%", borderRadius: 10 }}
      >
        <TileLayer attribution={DARK_TILE_ATTRIBUTION} url={DARK_TILE_URL} />
        <LiveMarkers rows={rows} />
      </MapContainer>
      <button
        type="button"
        onClick={() => setFullscreen((v) => !v)}
        aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
        className="absolute end-4 top-4 z-[1000] grid h-8 w-8 place-items-center rounded-control border border-hairline bg-surface text-ink hover:bg-raise"
      >
        {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
}
