/**
 * Plain anchor to a CSV export route (roadmap item 7) — a real download,
 * not a client-side blob, so it works with the route's own auth check and
 * needs no JS. Takes its label as a prop rather than translating itself, so
 * it stays usable from a Server Component without needing next-intl's
 * server/client API split (every caller already has `t` in scope).
 */
export function ExportCsvLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-control border border-hairline bg-surface px-3 py-1.5 text-button font-medium text-ink transition-colors hover:bg-raise"
    >
      {label}
    </a>
  );
}
