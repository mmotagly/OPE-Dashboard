"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";

/**
 * Leaflet's default marker icon resolves its image URLs relative to
 * whatever bundled the page — that breaks silently under Next.js unless
 * you patch the asset paths. A plain colored dot sidesteps that entirely,
 * and doubles as a status-color signal (the marker's tone matches the
 * operation's own status pill — amber while operating, green once
 * completed) rather than a generic pin. `var(--color-*)` references the
 * real design tokens rather than hardcoding hex, even inside this raw HTML
 * string — CLAUDE.md's "never hardcode a colour" rule still applies here.
 */
function dotIcon(tone: "warn" | "go") {
  const color = tone === "go" ? "var(--color-go)" : "var(--color-warn)";
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid var(--color-canvas);box-shadow:0 0 0 2px ${color}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function VehicleMap({
  latitude,
  longitude,
  tone,
}: {
  latitude: number;
  longitude: number;
  tone: "warn" | "go";
}) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: 220, width: "100%", borderRadius: 10 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={dotIcon(tone)} />
    </MapContainer>
  );
}
