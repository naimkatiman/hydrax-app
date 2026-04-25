import type { CSSProperties, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, type LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

export type ToastTone = "success" | "danger" | "info";

export interface ToastProps {
  readonly id: string;
  readonly tone: ToastTone;
  readonly message: string;
  readonly onDismiss?: (id: string) => void;
}

interface ToneStyle {
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
  readonly icon: LucideIcon;
}

const TONE_STYLE: Record<ToastTone, ToneStyle> = {
  success: {
    fg: "var(--hydrax-color-success)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-success)",
    icon: CheckCircle2,
  },
  danger: {
    fg: "var(--hydrax-color-danger)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-danger)",
    icon: AlertCircle,
  },
  info: {
    fg: "var(--hydrax-color-text-strong)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-border)",
    icon: Info,
  },
};

export function Toast({ id, tone, message, onDismiss }: ToastProps): ReactNode {
  const style = TONE_STYLE[tone];
  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--hydrax-space-sm)",
    padding: "10px 14px 10px 12px",
    borderRadius: "var(--hydrax-radius-md)",
    background: style.bg,
    color: style.fg,
    border: `1px solid ${style.border}`,
    boxShadow: "var(--hydrax-shadow-md)",
    fontFamily: "var(--hydrax-font-sans)",
    fontSize: "var(--hydrax-type-body-sm-size)",
    lineHeight: "var(--hydrax-type-body-sm-line-height)",
    minWidth: 260,
    maxWidth: 420,
    animation: "hydrax-toast-in var(--hydrax-motion-fast) var(--hydrax-ease-out)",
  };
  return (
    <div data-testid="toast-item" data-tone={tone} style={baseStyle}>
      <Icon icon={style.icon} label={`${tone} notification`} size={16} />
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(id)}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            opacity: 0.7,
            padding: 4,
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
