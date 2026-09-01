"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { MapFullscreenFrame } from "./map-fullscreen-frame";

/** Shared with fleet-location-map.tsx's imperative markers, so both maps'
 * popups show identical content in identical wording. */
export function vehicleTooltipText(vehicleCode: string, speedKmh: number | null): string {
  return speedKmh !== null ? `${vehicleCode} · ${speedKmh} km/h` : vehicleCode;
}

/**
 * Leaflet's default marker icon resolves its image URLs relative to
 * whatever bundled the page — that breaks silently under Next.js unless
 * you patch the asset paths. An inline SVG sidesteps that entirely, and
 * doubles as a status-color signal (the marker's tone matches the
 * operation's own status pill — amber while operating, green once
 * completed) rather than a generic pin. `var(--color-*)` references the
 * real design tokens rather than hardcoding hex, even inside this raw HTML
 * string — CLAUDE.md's "never hardcode a colour" rule still applies here.
 * Shared with `fleet-location-map.tsx` so both maps use one marker.
 */
export function busIcon(tone: "warn" | "go" | "idle") {
  const color =
    tone === "go" ? "var(--color-go)" : tone === "warn" ? "var(--color-warn)" : "var(--color-idle)";
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:26px;height:26px;border-radius:9999px;background:${color};border:2px solid var(--color-canvas);box-shadow:0 0 0 1px ${color}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 16V6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5V16" stroke="var(--color-on-accent)" stroke-width="2" stroke-linecap="round"/>
        <rect x="4" y="8" width="16" height="8" rx="1.5" stroke="var(--color-on-accent)" stroke-width="2"/>
        <path d="M4 16v2a1 1 0 0 0 1 1h1.5M20 16v2a1 1 0 0 1-1 1h-1.5" stroke="var(--color-on-accent)" stroke-width="2" stroke-linecap="round"/>
        <circle cx="7.5" cy="19" r="1.5" fill="var(--color-on-accent)"/>
        <circle cx="16.5" cy="19" r="1.5" fill="var(--color-on-accent)"/>
      </svg>
    </span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/**
 * CARTO's free basemap CDN (both `dark_all` and `voyager`, tried first)
 * turned out to require a registered account to remove an "API KEY
 * REQUIRED" watermark stamped across every tile — real map data underneath,
 * but unusable as shipped. Confirmed by downloading real tiles at different
 * coordinates and diffing them (they were genuinely differentiated per
 * location, so the watermark is an account gate, not a data gap) — not
 * assumed from a plain HTTP 200. Plain OpenStreetMap tile.openstreetmap.org
 * (this app's original tile source) also isn't a real option here: their
 * usage policy explicitly asks embedded apps not to hotlink it, and a
 * bare request against it returns "Access blocked" already.
 *
 * Esri's ArcGIS Online "Canvas" basemaps are the option that's actually
 * free with no account/key: `World_Dark_Gray_Base` (the dark ground layer)
 * plus `World_Dark_Gray_Reference` (a separate, transparent overlay layer
 * of just the labels — stacked as a second TileLayer) — verified the same
 * way, real differentiated tiles at real Giza-area coordinates, no
 * watermark. Esri does require the specific attribution string below
 * (pulled from the service's own metadata), same as any tile provider.
 */
export const DARK_TILE_BASE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
export const DARK_TILE_LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
export const DARK_TILE_MAX_ZOOM = 16;
export const DARK_TILE_ATTRIBUTION =
  "Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community";

export function VehicleMap({
  latitude,
  longitude,
  tone,
  vehicleCode,
  speedKmh,
}: {
  latitude: number;
  longitude: number;
  tone: "warn" | "go";
  vehicleCode: string;
  speedKmh: number | null;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <MapFullscreenFrame fullscreen={fullscreen} onToggle={() => setFullscreen((v) => !v)} height={220}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={fullscreen ? 16 : 14}
        maxZoom={DARK_TILE_MAX_ZOOM}
        scrollWheelZoom={fullscreen}
        style={{ height: fullscreen ? "100%" : 220, width: "100%", borderRadius: 10 }}
      >
        <TileLayer attribution={DARK_TILE_ATTRIBUTION} url={DARK_TILE_BASE_URL} maxNativeZoom={DARK_TILE_MAX_ZOOM} />
        <TileLayer url={DARK_TILE_LABELS_URL} maxNativeZoom={DARK_TILE_MAX_ZOOM} />
        <Marker position={[latitude, longitude]} icon={busIcon(tone)}>
          <Tooltip direction="top" offset={[0, -14]}>
            {vehicleTooltipText(vehicleCode, speedKmh)}
          </Tooltip>
        </Marker>
      </MapContainer>
    </MapFullscreenFrame>
  );
}
