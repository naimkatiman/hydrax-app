import { useGetHealthzCompositeQuery } from "@hydrax/api-client";
import type {
  CompositeHealth,
  CompositeHealthStatus,
  UpstreamHealth,
  UpstreamHealthStatus,
} from "@hydrax/api-client";
import { Card, Button, Icon } from "@hydrax/ui";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

const POLL_INTERVAL_MS = 5000;
const ERROR_TRUNCATE = 80;

interface StatusGlyph {
  readonly icon: typeof CheckCircle2;
  readonly color: string;
  readonly label: string;
}

function glyphForUpstream(s: UpstreamHealthStatus): StatusGlyph {
  if (s === "ok") {
    return { icon: CheckCircle2, color: "#16a34a", label: "ok" };
  }
  if (s === "unreachable") {
    return { icon: AlertCircle, color: "#d97706", label: "unreachable" };
  }
  return { icon: XCircle, color: "#dc2626", label: "down" };
}

function glyphForBff(s: CompositeHealthStatus): StatusGlyph {
  if (s === "ok") {
    return { icon: CheckCircle2, color: "#16a34a", label: "ok" };
  }
  if (s === "degraded") {
    return { icon: AlertCircle, color: "#d97706", label: "degraded" };
  }
  return { icon: XCircle, color: "#dc2626", label: "down" };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const tileStyle: CSSProperties = {
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-md)",
  padding: 12,
  background: "var(--hydrax-color-bg)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
};

const monoStyle: CSSProperties = {
  fontFamily: "var(--hydrax-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: 13,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const statusRowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
};

const metaStyle: CSSProperties = {
  color: "var(--hydrax-color-text-muted)",
  fontSize: 12,
};

const errorStyle: CSSProperties = {
  color: "#dc2626",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

interface BffTileProps {
  readonly composite: CompositeHealth;
}

function BffTile({ composite }: BffTileProps): ReactNode {
  const g = glyphForBff(composite.status);
  return (
    <div style={tileStyle} data-testid="health-tile-bff">
      <span style={monoStyle}>
        <Icon icon={Server} label="bff icon" size={14} /> bff
      </span>
      <span style={statusRowStyle}>
        <Icon icon={g.icon} label={`bff status ${g.label}`} size={16} color={g.color} />
        <span style={{ color: g.color }}>{g.label}</span>
      </span>
      <span style={metaStyle}>
        upstreams ok:{" "}
        {composite.upstreams.filter((u) => u.ok).length}/{composite.upstreams.length}
      </span>
    </div>
  );
}

interface UpstreamTileProps {
  readonly upstream: UpstreamHealth;
}

function UpstreamTile({ upstream }: UpstreamTileProps): ReactNode {
  const g = glyphForUpstream(upstream.status);
  return (
    <div
      style={tileStyle}
      data-testid={`health-tile-${upstream.service}`}
      data-status={upstream.status}
    >
      <span style={monoStyle}>{upstream.service}</span>
      <span style={statusRowStyle}>
        <Icon
          icon={g.icon}
          label={`${upstream.service} status ${g.label}`}
          size={16}
          color={g.color}
        />
        <span style={{ color: g.color }}>{g.label}</span>
      </span>
      <span style={metaStyle}>
        {upstream.latencyMs}ms
        {typeof upstream.httpStatus === "number" ? ` · HTTP ${upstream.httpStatus}` : ""}
      </span>
      {upstream.error ? (
        <span style={errorStyle} title={upstream.error}>
          {truncate(upstream.error, ERROR_TRUNCATE)}
        </span>
      ) : null}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    return `BFF error (status ${String((error as { status: unknown }).status)})`;
  }
  if (error instanceof Error) return error.message;
  return "Unable to reach BFF";
}

export function HealthRoute(): ReactNode {
  const { data, error, isLoading, isFetching, refetch } = useGetHealthzCompositeQuery(
    undefined,
    { pollingInterval: POLL_INTERVAL_MS },
  );

  return (
    <Card
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon={Activity} label="Platform health" size={18} />
            <h1 style={{ margin: 0, fontSize: 20 }}>Platform Health</h1>
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              void refetch();
            }}
            disabled={isFetching}
            aria-label="Refresh now"
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon icon={RefreshCw} label="refresh" size={14} />
              Refresh now
            </span>
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <p>Loading…</p>
      ) : error ? (
        <p role="alert" style={{ color: "#dc2626" }}>
          {getErrorMessage(error)}
        </p>
      ) : data ? (
        <div
          data-testid="health-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <BffTile composite={data} />
          {data.upstreams.map((u) => (
            <UpstreamTile key={u.service} upstream={u} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}
