import { useParams } from "react-router-dom";
import { hydraxApi, useGetProductQuery } from "@hydrax/api-client";
import { Button, Heading, Skeleton, Stack, Text } from "@hydrax/ui";

const useTransitionProductMutation =
  hydraxApi.endpoints.transitionProduct.useMutation;

export function ProductDetailRoute() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetProductQuery(id, { skip: !id });
  const [transition, transitionState] = useTransitionProductMutation();

  if (isLoading) {
    return <Skeleton aria-label="Loading product" />;
  }

  if (isError || !data) {
    return (
      <Text tone="danger" role="alert">
        Could not load product.
      </Text>
    );
  }

  const allowed = data.allowed_next ?? [];
  const handleTransition = (to: string): void => {
    if (!id) return;
    void transition({ id, to });
  };

  return (
    <Stack gap="lg">
      <Heading level="h1">{data.name}</Heading>
      <Stack gap="sm">
        <Text>
          <Text tone="muted">Code: </Text>
          {data.code}
        </Text>
        <Text>
          <Text tone="muted">Type: </Text>
          {data.product_type}
        </Text>
        <Text>
          <Text tone="muted">Status: </Text>
          {data.status}
        </Text>
        <Text>
          <Text tone="muted">Created: </Text>
          {data.created_at}
        </Text>
      </Stack>
      <Stack gap="sm">
        <Heading level="h2">Lifecycle actions</Heading>
        {allowed.length === 0 ? (
          <Text tone="muted" data-testid="terminal-state">
            No further actions — product is in a terminal state.
          </Text>
        ) : (
          <Stack gap="sm">
            {allowed.map((to) => (
              <Button
                key={to}
                data-testid={`transition-${to}`}
                disabled={transitionState.isLoading}
                onClick={() => handleTransition(to)}
              >
                {`Transition to ${to}`}
              </Button>
            ))}
          </Stack>
        )}
        {transitionState.isError && (
          <Text tone="danger" role="alert" data-testid="transition-error">
            Transition failed.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
