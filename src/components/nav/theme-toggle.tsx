"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "light" | "dark";

/**
 * Manual light/dark switch. Dark is the default for every existing session —
 * nothing changes until a viewer opts in here. The choice is a display
 * preference, not application data, so it's a plain cookie (read
 * server-side in the root layout, avoiding a flash) rather than a DB row.
 */
export function ThemeToggle({
  initialTheme,
  collapsed = false,
}: {
  initialTheme: Theme;
  collapsed?: boolean;
}) {
  const t = useTranslations("nav");
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? t("switchToDark") : t("switchToLight")}
      title={isLight ? t("switchToDark") : t("switchToLight")}
      className={`mt-1.5 flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-nav-item text-ink-2 transition-colors hover:bg-raise ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <span aria-hidden className="grid h-3.5 w-3.5 place-items-center">
        {isLight ? (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
            <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              d="M8 1.2v1.4M8 13.4v1.4M14.8 8h-1.4M2.6 8H1.2M12.7 3.3l-1 1M4.3 11.7l-1 1M12.7 12.7l-1-1M4.3 4.3l-1-1"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
            <path
              fill="currentColor"
              d="M13.8 9.9A6 6 0 0 1 6.1 2.2a6.3 6.3 0 1 0 7.7 7.7Z"
            />
          </svg>
        )}
      </span>
      {!collapsed && <span>{isLight ? t("lightMode") : t("darkMode")}</span>}
    </button>
  );
}
