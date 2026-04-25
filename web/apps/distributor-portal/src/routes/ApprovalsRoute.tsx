import { CheckSquare } from "lucide-react";
import { Card, EmptyState, Heading, Stack, Text, Button, Skeleton } from "@hydrax/ui";
import { useListPendingApprovalsQuery, useDecideApprovalMutation } from "@hydrax/api-client";

const HARDCODED_DECIDER = "distributor-operator-1";

export function ApprovalsRoute() {
  const { data, isFetching, error, refetch } = useListPendingApprovalsQuery();
  const [decide, { isLoading: deciding }] = useDecideApprovalMutation();

  const onDecide = async (id: string, status: "approved" | "rejected") => {
    await decide({ id, status, decided_by_user_id: HARDCODED_DECIDER });
    refetch();
  };

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Approvals</Heading>
        <Text tone="muted">Pending decisions queued from upstream business events.</Text>
      </Stack>
      <Card title={<Heading level="h2">Queue</Heading>}>
        {isFetching ? (
          <Stack gap="sm">
            <Skeleton width="100%" height={48} />
            <Skeleton width="100%" height={48} />
          </Stack>
        ) : error ? (
          <Text tone="danger" role="alert">Failed to load approvals.</Text>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            iconLabel="Empty queue"
            title="No pending approvals"
            body="When upstream events queue an approval, it appears here."
          />
        ) : (
          <Stack gap="md">
            {data.map((a) => (
              <Stack
                key={a.id}
                direction="row"
                align="center"
                gap="md"
                justify="between"
              >
                <Stack gap="xs">
                  <Text family="mono">{a.resource_type}/{a.resource_id}</Text>
                  <Text size="bodySm" tone="muted">tenant {a.tenant_id} · {a.created_at}</Text>
                </Stack>
                <Stack direction="row" gap="sm">
                  <Button onClick={() => onDecide(a.id, "approved")} disabled={deciding}>
                    Approve
                  </Button>
                  <Button onClick={() => onDecide(a.id, "rejected")} disabled={deciding} variant="secondary">
                    Reject
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
