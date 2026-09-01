"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Shared full-screen chrome for every map (fleet map, single-vehicle
 * preview). A `position: fixed; inset: 0` div only actually covers the
 * true viewport if nothing between it and `<body>` establishes its own
 * containing block — a transform, filter, `backdrop-filter`, `will-change`,
 * or `contain` on any ancestor changes that, and a map can end up nested
 * under one of these without whoever's placing it knowing. Rather than
 * audit every possible ancestor a map might ever be dropped into, this
 * portals the full-screen view straight into `document.body` — the same
 * fix already proven here for the mobile nav sheet, which hit this exact
 * class of bug against the topbar's `backdrop-blur` (see mobile-nav.tsx).
 *
 * Toggling remounts the map (the `<MapContainer>` in `children` moves to a
 * different DOM parent), which is what makes this correct rather than a
 * new invalidateSize() timing guess: Leaflet measures its container's real,
 * final size at construction, not mid-transition.
 */
export function MapFullscreenFrame({
  fullscreen,
  onToggle,
  height,
  children,
}: {
  fullscreen: boolean;
  onToggle: () => void;
  /** Height of the inline (non-fullscreen) map, in px. */
  height: number;
  children: ReactNode;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, onToggle]);

  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
      className="absolute end-4 top-4 z-[1000] grid h-8 w-8 place-items-center rounded-control border border-hairline bg-surface text-ink hover:bg-raise"
    >
      {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );

  if (fullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-canvas p-3">
        {children}
        {button}
      </div>,
      document.body,
    );
  }

  return (
    <div className="relative" style={{ height }}>
      {children}
      {button}
    </div>
  );
}
