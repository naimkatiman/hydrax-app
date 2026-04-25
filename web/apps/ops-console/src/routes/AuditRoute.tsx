import { useState, type FormEvent } from "react";
import { History } from "lucide-react";
import { Card, EmptyState, Heading, Stack, Text, Button, Skeleton } from "@hydrax/ui";
import { useListAuditEventsQuery } from "@hydrax/api-client";

export function AuditRoute() {
  const [draft, setDraft] = useState({ tenant_id: "", resource_type: "product", resource_id: "" });
  const [submitted, setSubmitted] = useState<typeof draft | null>(null);

  const { data, isFetching, error } = useListAuditEventsQuery(
    submitted ?? { tenant_id: "", resource_type: "", resource_id: "" },
    { skip: submitted === null },
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.tenant_id && draft.resource_type && draft.resource_id) setSubmitted(draft);
  };

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Audit</Heading>
        <Text tone="muted">Search the immutable action log by tenant + resource.</Text>
      </Stack>
      <Card title={<Heading level="h2">Filters</Heading>}>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--hydrax-space-md)" }}>
          <label>
            <Text size="bodySm" tone="muted" as="div">Tenant ID</Text>
            <input
              aria-label="tenant id"
              value={draft.tenant_id}
              onChange={(e) => setDraft((d) => ({ ...d, tenant_id: e.target.value }))}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            />
          </label>
          <label>
            <Text size="bodySm" tone="muted" as="div">Resource type</Text>
            <select
              aria-label="resource type"
              value={draft.resource_type}
              onChange={(e) => setDraft((d) => ({ ...d, resource_type: e.target.value }))}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            >
              <option value="product">product</option>
              <option value="subscription">subscription</option>
              <option value="user">user</option>
              <option value="tenant">tenant</option>
            </select>
          </label>
          <label>
            <Text size="bodySm" tone="muted" as="div">Resource ID</Text>
            <input
              aria-label="resource id"
              value={draft.resource_id}
              onChange={(e) => setDraft((d) => ({ ...d, resource_id: e.target.value }))}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            />
          </label>
          <Button type="submit">Search</Button>
        </form>
      </Card>
      <Card title={<Heading level="h2">Results</Heading>}>
        {submitted === null ? (
          <EmptyState
            icon={History}
            iconLabel="No search yet"
            title="Enter filters above"
            body="Audit events will appear here once you search."
          />
        ) : isFetching ? (
          <Stack gap="sm">
            <Skeleton width="100%" height={20} />
            <Skeleton width="80%" height={20} />
          </Stack>
        ) : error ? (
          <Text tone="danger" role="alert">Failed to load audit events.</Text>
        ) : data && data.length > 0 ? (
          <Stack gap="md">
            {data.map((ev) => (
              <Stack key={ev.id} gap="xs">
                <Text family="mono">{ev.action}</Text>
                <Text size="bodySm" tone="muted">
                  {ev.resource_type}/{ev.resource_id} · {ev.created_at}
                </Text>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text tone="muted">No events for this resource.</Text>
        )}
      </Card>
    </Stack>
  );
}
