import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
}) {
  const background =
    variant === "primary"
      ? "var(--accent)"
      : variant === "secondary"
        ? "var(--bg-elev)"
        : "transparent";
  const color = variant === "primary" ? "#1a140e" : "var(--ink)";
  return (
    <button
      {...props}
      style={{
        background,
        color,
        border: variant === "ghost" ? "1px solid var(--line)" : "1px solid transparent",
        borderRadius: 999,
        padding: "0.55rem 1rem",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        fontWeight: 600
      }}
    >
      {children}
    </button>
  );
}
