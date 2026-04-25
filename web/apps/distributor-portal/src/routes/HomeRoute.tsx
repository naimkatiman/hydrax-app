import { Inbox, TrendingUp, Briefcase, FileSignature, Receipt } from "lucide-react";
import {
  Card,
  EmptyState,
  Heading,
  Skeleton,
  Stack,
  Text,
  Icon,
} from "@hydrax/ui";
import emptyHero from "../../../../packages/ui/src/assets/distributor-empty-state.jpg";

interface HomeRouteProps {
  readonly connected?: boolean;
}

interface StatTileProps {
  readonly label: string;
  readonly icon: typeof TrendingUp;
  readonly iconLabel: string;
}

function StatTile({ label, icon, iconLabel }: StatTileProps) {
  return (
    <Card>
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center">
          <Icon icon={icon} label={iconLabel} size={14} />
          <Text size="bodySm" tone="muted">
            {label}
          </Text>
        </Stack>
        <Text family="mono" tone="strong" style={{ fontSize: "20px" }}>
          --
        </Text>
        <Text size="bodySm" tone="muted">
          No data connected yet.
        </Text>
      </Stack>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <Stack gap="md" style={{ padding: "var(--hydrax-space-md)" }}>
      {[0, 1, 2].map((i) => (
        <Stack key={i} direction="row" align="center" gap="md">
          <Skeleton width={32} height={32} radius="md" aria-label="Loading row icon" />
          <Stack gap="xs" style={{ flex: 1 }}>
            <Skeleton width="60%" height={14} aria-label="Loading row title" />
            <Skeleton width="35%" height={12} aria-label="Loading row meta" />
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

export function HomeRoute({ connected = false }: HomeRouteProps) {
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Home</Heading>
        <Text tone="muted">
          Distributor workspace. Connect an allocation feed to start populating these views.
        </Text>
      </Stack>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--hydrax-space-md)",
        }}
      >
        <StatTile label="Live allocations" icon={Briefcase} iconLabel="Allocations" />
        <StatTile label="Pending subscriptions" icon={FileSignature} iconLabel="Subscriptions" />
        <StatTile label="Settlements this week" icon={Receipt} iconLabel="Settlements" />
      </div>
      <Card title={<Heading level="h2">Recent activity</Heading>}>
        {connected ? (
          <ActivitySkeleton />
        ) : (
          <EmptyState
            icon={Inbox}
            iconLabel="No activity"
            title="No allocation activity yet"
            body="Once an allocation feed is connected, recent investor subscriptions and settlement events will appear here."
            imageSrc={emptyHero}
            imageAlt="Illustration of an empty distribution dashboard"
          />
        )}
      </Card>
    </Stack>
  );
}
