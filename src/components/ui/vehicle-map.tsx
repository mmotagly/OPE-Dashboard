"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { MapFullscreenFrame } from "./map-fullscreen-frame";

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
 * CARTO's free basemap tiles — no API key/account needed (unlike Google
 * Maps or Mapbox, deliberately avoided elsewhere in this app for exactly
 * that reason — see STATUS.md).
 *
 * Voyager, not the `dark_all` ("Dark Matter") style tried first: dark_all
 * is deliberately minimal — roads/labels are dimmed by design, and pushing
 * them back up with a brightness filter fights that design with a low
 * ceiling on the result. Voyager is CARTO's general-purpose style with far
 * more inherent road/water/label contrast; darkening *that* down via
 * `.map-tiles-dark` (globals.css) keeps its clarity while reading as dark
 * overall — verified directly against a.basemaps.cartocdn.com.
 */
export const DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
export const DARK_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function VehicleMap({
  latitude,
  longitude,
  tone,
}: {
  latitude: number;
  longitude: number;
  tone: "warn" | "go";
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <MapFullscreenFrame fullscreen={fullscreen} onToggle={() => setFullscreen((v) => !v)} height={220}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={fullscreen ? 16 : 14}
        scrollWheelZoom={fullscreen}
        style={{ height: fullscreen ? "100%" : 220, width: "100%", borderRadius: 10 }}
      >
        <TileLayer className="map-tiles-dark" attribution={DARK_TILE_ATTRIBUTION} url={DARK_TILE_URL} />
        <Marker position={[latitude, longitude]} icon={busIcon(tone)} />
      </MapContainer>
    </MapFullscreenFrame>
  );
}
