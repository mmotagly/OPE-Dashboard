/**
 * Plain JS mirror of the web app's design tokens (src/app/globals.css
 * `@theme` block, documented in CLAUDE.md section 5) — React Native's
 * StyleSheet has no CSS custom properties, so there's no way to share the
 * actual token source across the two apps. Keep these values in sync by
 * hand if the web palette ever changes.
 */
export const colors = {
  canvas: "#0B0D0E",
  surface: "#141719",
  raise: "#1A1E20",
  elev: "#1E2325",
  ink: "#F1F3F3",
  ink2: "#A3AAAE",
  ink3: "#6B7278",
  hairline: "#23282B",
  go: "#22C55E",
  warn: "#F0B429",
  stop: "#F0554E",
  idle: "#2C3235",
} as const;
