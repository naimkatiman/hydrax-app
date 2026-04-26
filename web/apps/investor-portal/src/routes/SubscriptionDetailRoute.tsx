import { useParams } from "react-router-dom";
import {
  useGetSubscriptionQuery,
  useListAuditEventsQuery,
} from "@hydrax/api-client";
import {
  AuditTimeline,
  Card,
  Heading,
  Skeleton,
  Stack,
  StatusPill,
  Text,
  type LifecycleState,
} from "@hydrax/ui";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

const KNOWN_STATES: ReadonlySet<LifecycleState> = new Set([
  "pending",
  "approved",
  "active",
  "matured",
  "cancelled",
]);

function asLifecycleState(s: string): LifecycleState {
  return KNOWN_STATES.has(s as LifecycleState) ? (s as LifecycleState) : "pending";
}

function formatAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

export function SubscriptionDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const sub = useGetSubscriptionQuery(id ?? "", { skip: !id });
  const events = useListAuditEventsQuery(
    { tenant_id: TENANT_ID, resource_type: "subscription", resource_id: id ?? "" },
    { skip: !id },
  );

  if (sub.isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton width="40%" height={36} />
        <Card><Skeleton width="100%" height={120} /></Card>
      </Stack>
    );
  }
  if (sub.isError || !sub.data) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Subscription not found</Heading>
        <Card>
          <Text tone="danger" role="alert">Could not load this subscription.</Text>
        </Card>
      </Stack>
    );
  }

  const subscription = sub.data;
  const allEvents = events.data ?? [];
  const subscriptionEvents = allEvents.filter(
    (e) => e.resource_type === "subscription" && e.resource_id === subscription.id,
  );

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Subscription</Heading>
        <Text family="mono" tone="muted">{subscription.id}</Text>
      </Stack>
      <Card title={<Heading level="h2">Details</Heading>}>
        <Stack gap="md">
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Status</Text>
            <StatusPill state={asLifecycleState(subscription.status)} />
          </Stack>
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Amount</Text>
            <Text>{formatAmount(subscription.amount_minor, subscription.currency)}</Text>
          </Stack>
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Product</Text>
            <Text family="mono">{subscription.product_id}</Text>
          </Stack>
        </Stack>
      </Card>
      <Card title={<Heading level="h2">Audit timeline</Heading>}>
        <AuditTimeline events={subscriptionEvents} />
      </Card>
    </Stack>
  );
}
