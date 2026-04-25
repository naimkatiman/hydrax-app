import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useGetProductQuery,
  useTransitionProductMutation,
} from "@hydrax/api-client";
import {
  Button,
  Heading,
  Icon,
  Skeleton,
  Stack,
  StatusPill,
  Text,
  useToast,
  type LifecycleState,
} from "@hydrax/ui";
import {
  CheckCircle2,
  Flag,
  PlayCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

interface TransitionAction {
  readonly to: Exclude<LifecycleState, "pending">;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly variant: "primary" | "secondary" | "danger";
}

const TRANSITION_ACTIONS: Record<
  Exclude<LifecycleState, "pending">,
  TransitionAction
> = {
  approved: {
    to: "approved",
    label: "Approve",
    icon: CheckCircle2,
    variant: "primary",
  },
  active: {
    to: "active",
    label: "Activate",
    icon: PlayCircle,
    variant: "primary",
  },
  matured: {
    to: "matured",
    label: "Mark as matured",
    icon: Flag,
    variant: "secondary",
  },
  cancelled: {
    to: "cancelled",
    label: "Cancel product",
    icon: XCircle,
    variant: "danger",
  },
};

export function ProductDetailRoute() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetProductQuery(id, { skip: !id });
  const [transition, transitionState] = useTransitionProductMutation();
  const {
    isLoading: isTransitionLoading,
    isSuccess: isTransitionSuccess,
    isError: isTransitionError,
    data: transitionedProduct,
    reset: resetTransitionState,
  } = transitionState;
  const { showToast } = useToast();

  useEffect(() => {
    if (isTransitionSuccess && transitionedProduct) {
      showToast({
        tone: "success",
        message: `Status updated to ${transitionedProduct.status}.`,
      });
      resetTransitionState();
    }
  }, [
    isTransitionSuccess,
    transitionedProduct,
    showToast,
    resetTransitionState,
  ]);

  useEffect(() => {
    if (isTransitionError) {
      showToast({ tone: "danger", message: "Transition failed." });
      resetTransitionState();
    }
  }, [isTransitionError, showToast, resetTransitionState]);

  const allowedActions = useMemo<readonly TransitionAction[]>(() => {
    const allowed = data?.allowed_next ?? [];
    return allowed
      .map((state) => {
        if (state === "pending") return null;
        return TRANSITION_ACTIONS[state as Exclude<LifecycleState, "pending">];
      })
      .filter((a): a is TransitionAction => Boolean(a));
  }, [data]);

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

  const handleTransition = (to: string): void => {
    if (!id) return;
    void transition({ id, to });
  };

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Heading level="h1">{data.name}</Heading>
        <StatusPill state={data.status as LifecycleState} />
      </Stack>
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
          <Text tone="muted">Created: </Text>
          {data.created_at}
        </Text>
      </Stack>
      <Stack gap="sm">
        <Heading level="h2">Lifecycle actions</Heading>
        {allowedActions.length === 0 ? (
          <Text tone="muted" data-testid="terminal-state">
            No further actions — product is in a terminal state.
          </Text>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--hydrax-space-sm)",
            }}
          >
            {allowedActions.map((a) => (
              <Button
                key={a.to}
                data-testid={`transition-${a.to}`}
                variant={a.variant}
                disabled={isTransitionLoading}
                onClick={() => handleTransition(a.to)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon icon={a.icon} label={a.label} size={14} />
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </Stack>
    </Stack>
  );
}
