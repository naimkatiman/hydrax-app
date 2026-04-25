import type { CSSProperties, ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--hydrax-color-accent)",
    color: "var(--hydrax-color-bg)",
    border: "1px solid var(--hydrax-color-accent)",
  },
  secondary: {
    background: "transparent",
    color: "var(--hydrax-color-text)",
    border: "1px solid var(--hydrax-color-border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--hydrax-color-text-muted)",
    border: "1px solid transparent",
  },
  danger: {
    background: "transparent",
    color: "var(--hydrax-color-danger)",
    border: "1px solid var(--hydrax-color-danger)",
  },
};

export function Button({
  variant = "primary",
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      style={{
        padding: "8px 14px",
        borderRadius: "var(--hydrax-radius-md)",
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: 14,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        ...VARIANT_STYLE[variant],
        ...style,
      }}
      {...rest}
    />
  );
}
