export interface Subscription {
  readonly id: string;
  readonly product_id: string;
  readonly investor_user_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateSubscriptionInput {
  readonly product_id: string;
  readonly investor_user_id: string;
  readonly amount_minor: number;
  readonly currency: string;
}

export interface ProxyOptions {
  readonly workflowSvcUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class SubscriptionsUpstreamError extends Error {
  readonly httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "SubscriptionsUpstreamError";
    this.httpStatus = httpStatus;
  }
}

async function withTimeout<T>(timeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSubscription(id: string, opts: Readonly<ProxyOptions>): Promise<Subscription> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.workflowSvcUrl}/v1/subscriptions/${encodeURIComponent(id)}`, { signal });
    } catch (err: unknown) {
      throw new SubscriptionsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new SubscriptionsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Subscription;
  });
}

export async function createSubscription(
  input: Readonly<CreateSubscriptionInput>,
  opts: Readonly<ProxyOptions>,
): Promise<Subscription> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.workflowSvcUrl}/v1/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new SubscriptionsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new SubscriptionsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Subscription;
  });
}
