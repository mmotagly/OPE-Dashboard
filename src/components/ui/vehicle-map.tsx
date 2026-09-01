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
 * CARTO's Basemaps API key (free, no CARTO account required — see
 * .env.example) fixes both prior problems in one move: the anonymous CDN's
 * "API KEY REQUIRED" watermark, and Esri's Dark Gray Canvas having
 * genuinely thin/no data for the Giza/Cairo area specifically (verified
 * directly: real tile fetches came back with an empty labels layer and an
 * explicit "no data" pattern at real Giza coordinates, z14-20). CARTO's
 * tiles are OSM-based and have real, detailed street names and labels for
 * this exact area — verified the same way, real differentiated tiles,
 * checked visually (found the Great Pyramid itself labeled at z16).
 *
 * Voyager, not `dark_all`: raw `dark_all` is CARTO's own deliberately
 * minimal dark style — its roads/labels are dimmed by design, which is
 * exactly why the very first version of this map (before Voyager or Esri
 * were ever tried) was already reported as "too dark, streets barely
 * visible." Voyager has far more inherent road/water/label contrast (its
 * own colours, not dark by default); `.map-tiles-dark` (globals.css) darkens
 * *that* down via a CSS filter so it reads as dark overall while keeping
 * that inherent clarity, instead of fighting dark_all's design back up.
 *
 * URL format confirmed against CARTO's own docs and a live fetch, not
 * assumed — `rastertiles/voyager`, not `voyager` alone (both are valid
 * paths on the anonymous CDN, but the keyed endpoint specifically wants
 * the `rastertiles/` prefix). `{s}` subdomain sharding and `{r}` retina
 * both confirmed working with the key.
 */
export const DARK_TILE_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`;
export const DARK_TILE_MAX_ZOOM = 20;
export const DARK_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

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
        <TileLayer
          className="map-tiles-dark"
          attribution={DARK_TILE_ATTRIBUTION}
          url={DARK_TILE_URL}
          maxNativeZoom={DARK_TILE_MAX_ZOOM}
        />
        <Marker position={[latitude, longitude]} icon={busIcon(tone)}>
          <Tooltip direction="top" offset={[0, -14]}>
            {vehicleTooltipText(vehicleCode, speedKmh)}
          </Tooltip>
        </Marker>
      </MapContainer>
    </MapFullscreenFrame>
  );
}
