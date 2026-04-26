import type { CSSProperties, ReactNode } from "react";
import { CheckCircle2, Clock, FileText, ShieldCheck, type LucideIcon } from "lucide-react";
import { Icon } from "./Icon";
import { Stack } from "./Stack";
import { Text } from "./Text";

export interface TimelineEvent {
  readonly id: string;
  readonly action: string;
  readonly created_at: string;
  readonly payload?: unknown;
  readonly actor_user_id?: string | null;
}

interface AuditTimelineProps {
  readonly events: ReadonlyArray<TimelineEvent>;
}

function iconForAction(action: string): { icon: LucideIcon; label: string } {
  if (action.endsWith(".created")) return { icon: FileText, label: "Created" };
  if (action.endsWith(".kyc_validated")) return { icon: ShieldCheck, label: "KYC validated" };
  if (action.endsWith(".queued_for_approval")) return { icon: Clock, label: "Queued" };
  if (action.endsWith(".approved") || action.endsWith(".transitioned")) {
    return { icon: CheckCircle2, label: "Approved" };
  }
  return { icon: FileText, label: "Event" };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function payloadPreview(payload: unknown): ReactNode {
  if (payload === null || payload === undefined) return null;
  try {
    return (
      <Text size="bodySm" tone="muted" family="mono">
        {JSON.stringify(payload)}
      </Text>
    );
  } catch {
    return null;
  }
}

const railStyle: CSSProperties = {
  position: "relative",
  paddingLeft: 28,
  borderLeft: "1px solid var(--hydrax-color-border)",
  marginLeft: 12,
};

const dotStyle: CSSProperties = {
  position: "absolute",
  left: -16,
  top: 4,
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "var(--hydrax-color-surface)",
  border: "1px solid var(--hydrax-color-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--hydrax-color-text-strong)",
};

export function AuditTimeline({ events }: AuditTimelineProps) {
  if (events.length === 0) {
    return <Text tone="muted">No events recorded yet.</Text>;
  }
  return (
    <Stack gap="lg">
      {events.map((e) => {
        const { icon, label } = iconForAction(e.action);
        return (
          <div key={e.id} style={railStyle}>
            <span style={dotStyle} aria-hidden="true">
              <Icon icon={icon} label={label} size={12} />
            </span>
            <Stack gap="xs">
              <Text family="mono">{e.action}</Text>
              <Text size="bodySm" tone="muted">{formatTime(e.created_at)}</Text>
              {payloadPreview(e.payload)}
            </Stack>
          </div>
        );
      })}
    </Stack>
  );
}
