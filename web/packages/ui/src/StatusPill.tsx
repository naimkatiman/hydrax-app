import type { CSSProperties, ReactNode } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  PlayCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "./Icon";

export type LifecycleState =
  | "pending"
  | "approved"
  | "active"
  | "matured"
  | "cancelled";

interface StateConfig {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
}

const STATE_CONFIG: Record<LifecycleState, StateConfig> = {
  pending: {
    label: "Pending",
    icon: Clock,
    fg: "var(--hydrax-color-text-muted)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-border)",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    fg: "var(--hydrax-color-accent)",
    bg: "var(--hydrax-color-accent-soft)",
    border: "var(--hydrax-color-accent)",
  },
  active: {
    label: "Active",
    icon: PlayCircle,
    fg: "var(--hydrax-color-success)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-success)",
  },
  matured: {
    label: "Matured",
    icon: Flag,
    fg: "var(--hydrax-color-text-strong)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-border)",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    fg: "var(--hydrax-color-danger)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-danger)",
  },
};

interface StatusPillProps {
  readonly state: LifecycleState;
  readonly style?: CSSProperties;
}

export function StatusPill({ state, style }: StatusPillProps): ReactNode {
  const known = STATE_CONFIG[state];
  const config: StateConfig = known ?? {
    label: String(state).replace(/^\w/, (c) => c.toUpperCase()),
    icon: Circle,
    fg: "var(--hydrax-color-text)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-border)",
  };

  return (
    <span
      data-testid="status-pill"
      data-state={state}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--hydrax-space-xs)",
        padding: "4px 10px",
        borderRadius: "var(--hydrax-radius-md)",
        background: config.bg,
        color: config.fg,
        border: `1px solid ${config.border}`,
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: "var(--hydrax-type-body-sm-size)",
        lineHeight: "var(--hydrax-type-body-sm-line-height)",
        fontWeight: 500,
        letterSpacing: "0.01em",
        ...style,
      }}
    >
      {state === "active" && (
        <span
          data-testid="status-pill-pulse"
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: config.fg,
            animation: "hydrax-status-pulse 2.4s ease-in-out infinite",
          }}
        />
      )}
      <Icon icon={config.icon} label={`${config.label} status`} size={14} />
      <span>{config.label}</span>
      <style>{`
        @keyframes hydrax-status-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
      `}</style>
    </span>
  );
}
