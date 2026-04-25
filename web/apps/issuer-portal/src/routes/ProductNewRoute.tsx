import { useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateProductMutation } from "@hydrax/api-client";
import { Button, Heading, Stack, Text } from "@hydrax/ui";

const PRODUCT_TYPES: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: "short_duration_credit", label: "Short-duration credit" },
  { value: "mmf", label: "Money market fund" },
  { value: "treasury_equivalent", label: "Treasury-equivalent" },
  { value: "equity_linked", label: "Equity-linked" },
];

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--hydrax-space-xs)",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: "var(--hydrax-type-body-sm-size)",
  color: "var(--hydrax-color-text-muted)",
};

const fieldStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: "var(--hydrax-radius-md)",
  border: "1px solid var(--hydrax-color-border)",
  background: "var(--hydrax-color-bg)",
  color: "var(--hydrax-color-text)",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: "var(--hydrax-type-body-size)",
};

export function ProductNewRoute() {
  const navigate = useNavigate();
  const [createProduct, { isLoading, error }] = useCreateProductMutation();
  const [tenantId, setTenantId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [productType, setProductType] = useState("short_duration_credit");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await createProduct({
      tenant_id: tenantId,
      code,
      name,
      product_type: productType,
    });
    if ("data" in result && result.data) {
      navigate(`/products/${result.data.id}`);
    }
  }

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Heading level="h1">New product</Heading>
        <Text tone="muted">
          Create a tokenized product. Status starts as <code>pending</code> until ops approves.
        </Text>
      </Stack>
      <form onSubmit={onSubmit} aria-label="New product">
        <Stack gap="md">
          <label style={labelStyle}>
            Tenant ID
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Code
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={fieldStyle}
            />
          </label>
          <label style={labelStyle}>
            Product type
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              style={fieldStyle}
            >
              {PRODUCT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <Stack direction="row" gap="md" align="center">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating…" : "Create product"}
            </Button>
            {error ? (
              <Text tone="danger" role="alert">
                Failed to create product. Try again.
              </Text>
            ) : null}
          </Stack>
        </Stack>
      </form>
    </Stack>
  );
}
