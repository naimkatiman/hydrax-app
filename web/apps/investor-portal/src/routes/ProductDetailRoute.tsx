import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useGetProductQuery } from "@hydrax/api-client";
import {
  Card,
  Heading,
  Icon,
  Skeleton,
  Stack,
  StatusPill,
  Text,
  type LifecycleState,
} from "@hydrax/ui";

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

export function ProductDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetProductQuery(id ?? "", { skip: !id });

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton width="40%" height={36} />
        <Card><Skeleton width="100%" height={120} /></Card>
      </Stack>
    );
  }
  if (isError || !data) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Product not found</Heading>
        <Card>
          <Text tone="danger" role="alert">Could not load this product.</Text>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">{data.name}</Heading>
        <Text family="mono" tone="muted">{data.code}</Text>
      </Stack>
      <Card title={<Heading level="h2">Details</Heading>}>
        <Stack gap="md">
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Status</Text>
            <StatusPill state={asLifecycleState(data.status)} />
          </Stack>
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Type</Text>
            <Text>{data.product_type}</Text>
          </Stack>
          {data.rails_product_id ? (
            <Stack direction="row" gap="md" align="center">
              <Text tone="muted">Rails id</Text>
              <Text family="mono">{data.rails_product_id}</Text>
            </Stack>
          ) : null}
        </Stack>
      </Card>
      <Stack direction="row" gap="md">
        <Link
          to={`/subscribe?product=${encodeURIComponent(data.id)}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "var(--hydrax-color-accent)",
            color: "var(--hydrax-color-bg)",
            borderRadius: "var(--hydrax-radius-sm)",
            textDecoration: "none",
            fontFamily: "var(--hydrax-font-sans)",
          }}
        >
          <span>Subscribe</span>
          <Icon icon={ArrowRight} label="Subscribe" size={14} />
        </Link>
      </Stack>
    </Stack>
  );
}
