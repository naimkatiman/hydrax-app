import type { ReactNode, CSSProperties } from "react";
import { Card, Heading, Stack, Text, Icon } from "@hydrax/ui";
import { Database, AlertTriangle, CheckCircle2 } from "lucide-react";

type Store = "postgres" | "mongo";

interface Projection {
  readonly name: string;
  readonly store: Store;
  readonly lastEventAt: string;
  readonly lagSeconds: number;
  readonly eventsPerSecond: number;
  readonly lastError?: string;
}

const PROJECTIONS: ReadonlyArray<Projection> = [
  {
    name: "products_read",
    store: "postgres",
    lastEventAt: "2026-04-26T11:42:08Z",
    lagSeconds: 0.4,
    eventsPerSecond: 12.3,
  },
  {
    name: "subscriptions_read",
    store: "postgres",
    lastEventAt: "2026-04-26T11:42:07Z",
    lagSeconds: 1.2,
    eventsPerSecond: 8.1,
  },
  {
    name: "approvals_read",
    store: "postgres",
    lastEventAt: "2026-04-26T11:42:06Z",
    lagSeconds: 2.7,
    eventsPerSecond: 4.4,
  },
  {
    name: "audit_events",
    store: "mongo",
    lastEventAt: "2026-04-26T11:42:08Z",
    lagSeconds: 0.6,
    eventsPerSecond: 18.7,
  },
  {
    name: "notification_envelopes",
    store: "mongo",
    lastEventAt: "2026-04-26T11:41:51Z",
    lagSeconds: 17.4,
    eventsPerSecond: 0.9,
    lastError: "destination unreachable: smtp-relay timeout",
  },
];

const STALE_THRESHOLD_SECONDS = 5;

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--hydrax-type-body-size)",
};

const cellStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--hydrax-color-border)",
  textAlign: "left",
  verticalAlign: "top",
};

const headerCellStyle: CSSProperties = {
  ...cellStyle,
  fontFamily: "var(--hydrax-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: "var(--hydrax-type-body-sm-size)",
  color: "var(--hydrax-color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

function formatLag(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function ProjectionsRoute(): ReactNode {
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon icon={Database} label="Projections" size={18} />
          <Heading level="h1">Projections</Heading>
        </span>
      }
    >
      <Stack gap="md">
        <Text tone="muted">
          Each row is one off-ledger read model fed by the canton-adapter event stream. Stale projections (lag &gt; {STALE_THRESHOLD_SECONDS}s) are flagged for operator attention. Errors surface inline with the most recent failure.
        </Text>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Projection</th>
              <th style={headerCellStyle}>Store</th>
              <th style={headerCellStyle}>Last event</th>
              <th style={headerCellStyle}>Lag</th>
              <th style={headerCellStyle}>Events/sec</th>
              <th style={headerCellStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {PROJECTIONS.map((p) => {
              const stale = p.lagSeconds > STALE_THRESHOLD_SECONDS || Boolean(p.lastError);
              return (
                <tr key={p.name} data-testid={`projection-row-${p.name}`}>
                  <td style={cellStyle}>
                    <code style={{ fontFamily: "var(--hydrax-font-mono, monospace)" }}>{p.name}</code>
                  </td>
                  <td style={cellStyle}>{p.store}</td>
                  <td style={cellStyle}>
                    <code style={{ fontFamily: "var(--hydrax-font-mono, monospace)" }}>{p.lastEventAt}</code>
                  </td>
                  <td
                    style={cellStyle}
                    data-testid={stale ? `lag-stale-${p.name}` : `lag-fresh-${p.name}`}
                  >
                    <span style={{ color: stale ? "var(--hydrax-color-danger)" : "var(--hydrax-color-text-strong)" }}>
                      {formatLag(p.lagSeconds)}
                    </span>
                  </td>
                  <td style={cellStyle}>{p.eventsPerSecond.toFixed(1)}</td>
                  <td style={cellStyle}>
                    {stale ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--hydrax-color-danger)" }}>
                        <Icon icon={AlertTriangle} label="stale" size={14} />
                        {p.lastError ?? "stale"}
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--hydrax-color-success)" }}>
                        <Icon icon={CheckCircle2} label="ok" size={14} />
                        ok
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Stack>
    </Card>
  );
}
