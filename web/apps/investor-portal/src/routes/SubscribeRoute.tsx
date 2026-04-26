import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCreateSubscriptionMutation } from "@hydrax/api-client";
import { Button, Card, Heading, Stack, Text } from "@hydrax/ui";

const HARDCODED_INVESTOR = "dddddddd-1111-4ddd-8ddd-000000000002";

export function SubscribeRoute() {
  const [params] = useSearchParams();
  const productId = params.get("product") ?? "";
  const [amount, setAmount] = useState("250000");
  const [createSubscription, { isLoading, error }] = useCreateSubscriptionMutation();
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const amountMinor = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0 || !productId) return;
    const result = await createSubscription({
      product_id: productId,
      amount_minor: amountMinor,
      currency: "USD",
      investor_user_id: HARDCODED_INVESTOR,
    });
    if ("data" in result && result.data) {
      navigate(`/subscriptions/${result.data.id}`);
    }
  }

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Subscribe</Heading>
        <Text tone="muted">Enter the amount you wish to subscribe.</Text>
      </Stack>
      <Card title={<Heading level="h2">Subscription details</Heading>}>
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <Stack gap="xs">
              <Text tone="muted">Product</Text>
              <Text family="mono">{productId || "(none — open from a product detail page)"}</Text>
            </Stack>
            <Stack gap="xs">
              <label htmlFor="subscribe-amount">
                <Text tone="muted">Amount (USD)</Text>
              </label>
              <input
                id="subscribe-amount"
                aria-label="Amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                step={1}
                style={{
                  padding: "8px 10px",
                  background: "var(--hydrax-color-surface)",
                  border: "1px solid var(--hydrax-color-border)",
                  borderRadius: "var(--hydrax-radius-sm)",
                  color: "var(--hydrax-color-text-strong)",
                  fontFamily: "var(--hydrax-font-sans)",
                  fontSize: "var(--hydrax-type-body-size)",
                  width: 240,
                }}
              />
            </Stack>
            {error ? (
              <Text tone="danger" role="alert">Submission failed.</Text>
            ) : null}
            <Stack direction="row" gap="md">
              <Button type="submit" disabled={isLoading || !productId}>
                {isLoading ? "Submitting..." : "Submit"}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
