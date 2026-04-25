import { useParams } from "react-router-dom";
import { useGetProductQuery } from "@hydrax/api-client";
import { Heading, Skeleton, Stack, Text } from "@hydrax/ui";

export function ProductDetailRoute() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetProductQuery(id, { skip: !id });

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
    </Stack>
  );
}
