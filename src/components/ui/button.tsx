import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger";
};

/** `primary` is accent-filled — DESIGN_SYSTEM.md reserves brand accent for
 * the logo, the active nav item, and one primary button per screen. */
const VARIANT = {
  default: "border-hairline bg-surface text-ink hover:bg-raise",
  primary: "border-accent-fill bg-accent-fill text-on-accent hover:opacity-90",
  danger: "border-stop bg-transparent text-stop-text hover:bg-stop-soft",
} as const;

export function Button({ variant = "default", className = "", ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`rounded-control border px-3.5 py-2 text-button font-medium transition-colors disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    />
  );
}
