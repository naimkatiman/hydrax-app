import { useState } from "react";
import {
  Archive,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileX2,
  PackagePlus,
  type LucideIcon,
} from "lucide-react";
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

const PAGE_SIZE = 50;

function statusIcon(status: string): { icon: LucideIcon; label: string } {
  switch (status) {
    case "approved":
    case "active":
      return { icon: CheckCircle2, label: "Approved" };
    case "cancelled":
      return { icon: FileX2, label: "Cancelled" };
    case "matured":
      return { icon: Archive, label: "Matured" };
    case "pending":
    default:
      return { icon: Clock, label: "Pending" };
  }
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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
              <Heading level="h2" as="h3">
                {product.name}
              </Heading>
              <Text size="bodySm" tone="muted">
                {product.code}
              </Text>
            </Stack>
            <Text size="bodySm" tone="muted">
              {product.product_type}
            </Text>
          </div>
          <Stack direction="row" gap="sm" align="center">
            <Icon icon={icon} label={label} size={16} />
            <Text size="bodySm">{product.status}</Text>
          </Stack>
          <Text size="bodySm" tone="muted">
            {formatCreatedAt(product.created_at)}
          </Text>
        </Stack>
      </Card>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <Stack gap="md">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <Stack direction="row" align="center" gap="md">
            <Skeleton width={32} height={32} radius="md" aria-label="Loading row icon" />
            <Stack gap="xs" style={{ flex: 1 }}>
              <Skeleton width="40%" height={16} aria-label="Loading row title" />
              <Skeleton width="25%" height={12} aria-label="Loading row meta" />
            </Stack>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

interface PageNavProps {
  readonly offset: number;
  readonly count: number;
  readonly hasNext: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

const navButtonStyle = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  background: disabled ? "transparent" : "var(--hydrax-color-bg-raised)",
  color: disabled ? "var(--hydrax-color-text-muted)" : "var(--hydrax-color-text)",
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-sm)",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: 14,
  opacity: disabled ? 0.5 : 1,
});

function PageNav({ offset, count, hasNext, onPrev, onNext }: PageNavProps) {
  const hasPrev = offset > 0;
  const start = count === 0 ? 0 : offset + 1;
  const end = offset + count;
  return (
    <Stack direction="row" align="center" gap="md" wrap>
      <Text size="bodySm" tone="muted">
        {count === 0 ? "No results" : `Showing ${start}–${end}`}
      </Text>
      <button
        type="button"
        data-testid="pagination-prev"
        disabled={!hasPrev}
        onClick={onPrev}
        style={navButtonStyle(!hasPrev)}
      >
        <Icon icon={ChevronLeft} label="Previous page" size={14} />
        <span>Previous</span>
      </button>
      <button
        type="button"
        data-testid="pagination-next"
        disabled={!hasNext}
        onClick={onNext}
        style={navButtonStyle(!hasNext)}
      >
        <span>Next</span>
        <Icon icon={ChevronRight} label="Next page" size={14} />
      </button>
    </Stack>
  );
}

export function ProductsListRoute() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useListProductsQuery({
    limit: PAGE_SIZE,
    offset,
  });

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
          <Text tone="danger" role="alert">
            Could not load products.
          </Text>
        </Card>
      </Stack>
    );
  }

  const products = data.products;
  const hasNext = data.next_offset !== null;

  if (products.length === 0 && offset === 0) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Products</Heading>
        <EmptyState
          icon={Boxes}
          iconLabel="No products"
          title="No products yet"
          body="Create your first product to start the issuance workflow."
          action={
            <Link
              to="/products/new"
              data-testid="empty-state-cta"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "var(--hydrax-color-accent)",
                color: "var(--hydrax-color-on-accent)",
                borderRadius: "var(--hydrax-radius-sm)",
                textDecoration: "none",
                fontFamily: "var(--hydrax-font-sans)",
              }}
            >
              <Icon icon={PackagePlus} label="New product" size={16} />
              <span>New product</span>
            </Link>
          }
        />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Heading level="h1">Products</Heading>
        <Text tone="muted">
          {products.length} product{products.length === 1 ? "" : "s"} on this page.
        </Text>
      </Stack>
      <Stack gap="md">
        {products.map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}
      </Stack>
      <PageNav
        offset={offset}
        count={products.length}
        hasNext={hasNext}
        onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        onNext={() => {
          if (data.next_offset !== null) setOffset(data.next_offset);
        }}
      />
    </Stack>
  );
}
