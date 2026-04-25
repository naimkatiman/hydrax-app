import { useState, type FormEvent } from "react";
import { FileSignature } from "lucide-react";
import { Card, EmptyState, Heading, Stack, Text, Button, Skeleton } from "@hydrax/ui";
import { useGetSubscriptionQuery } from "@hydrax/api-client";

function formatAmount(minor: number, ccy: string): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;
}

export function SubscriptionsRoute() {
  const [draft, setDraft] = useState("");
  const [id, setId] = useState<string | null>(null);
  const { data, isFetching, error } = useGetSubscriptionQuery(id ?? "", { skip: id === null });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) setId(draft.trim());
  };

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Subscriptions</Heading>
        <Text tone="muted">Look up a subscription by id to see status and lifecycle.</Text>
      </Stack>
      <Card title={<Heading level="h2">Lookup</Heading>}>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--hydrax-space-md)" }}>
          <label>
            <Text size="bodySm" tone="muted" as="div">Subscription ID</Text>
            <input
              aria-label="subscription id"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            />
          </label>
          <Button type="submit">Lookup</Button>
        </form>
      </Card>
      <Card title={<Heading level="h2">Detail</Heading>}>
        {id === null ? (
          <EmptyState
            icon={FileSignature}
            iconLabel="No subscription"
            title="Enter a subscription ID"
            body="Detail will appear here."
          />
        ) : isFetching ? (
          <Skeleton width="100%" height={48} />
        ) : error ? (
          <Text tone="danger" role="alert">Failed to load subscription.</Text>
        ) : data ? (
          <Stack gap="sm">
            <Text family="mono">{data.id}</Text>
            <Text>Product: {data.product_id}</Text>
            <Text>Amount: {formatAmount(data.amount_minor, data.currency)}</Text>
            <Text>Status: {data.status}</Text>
          </Stack>
        ) : null}
      </Card>
    </Stack>
  );
}
