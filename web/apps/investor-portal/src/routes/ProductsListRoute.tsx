import { Boxes, CheckCircle2, Clock, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useListProductsQuery, type Product } from "@hydrax/api-client";
import {
  Card,
  EmptyState,
  Heading,
  Icon,
  Skeleton,
  Stack,
  Text,
} from "@hydrax/ui";

function statusIcon(status: string): { icon: LucideIcon; label: string } {
  if (status === "active" || status === "approved") return { icon: CheckCircle2, label: status };
  return { icon: Clock, label: status };
}

function ProductRow({ product }: { readonly product: Product }) {
  const { icon, label } = statusIcon(product.status);
  return (
    <Link
      to={`/products/${product.id}`}
      data-testid={`product-row-${product.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Card>
        <Stack direction="row" align="center" gap="md" wrap>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <Stack direction="row" gap="sm" align="center">
              <Heading level="h2" as="h3">{product.name}</Heading>
              <Text size="bodySm" tone="muted">{product.code}</Text>
            </Stack>
            <Text size="bodySm" tone="muted">{product.product_type}</Text>
          </div>
          <Stack direction="row" gap="sm" align="center">
            <Icon icon={icon} label={label} size={16} />
            <Text size="bodySm">{product.status}</Text>
          </Stack>
        </Stack>
      </Card>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <Stack gap="md">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Skeleton width="100%" height={48} />
        </Card>
      ))}
    </Stack>
  );
}

export function ProductsListRoute() {
  const { data, isLoading, isError } = useListProductsQuery();

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Products</Heading>
        <ListSkeleton />
      </Stack>
    );
  }
  if (isError || !data) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Products</Heading>
        <Card>
          <Text tone="danger" role="alert">Could not load products.</Text>
        </Card>
      </Stack>
    );
  }
  if (data.products.length === 0) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Products</Heading>
        <EmptyState
          icon={Boxes}
          iconLabel="No products"
          title="No products available"
          body="Check back later for new offerings."
        />
      </Stack>
    );
  }
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Heading level="h1">Products</Heading>
        <Text tone="muted">Available offerings for subscription.</Text>
      </Stack>
      <Stack gap="md">
        {data.products.map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}
      </Stack>
    </Stack>
  );
}
