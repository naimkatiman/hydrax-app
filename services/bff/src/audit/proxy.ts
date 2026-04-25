export interface AuditEvent {
  readonly id: string;
  readonly tenant_id: string;
  readonly actor_user_id: string | null;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly payload: unknown;
  readonly created_at: string;
}

export interface CreateAuditEventInput {
  readonly tenant_id: string;
  readonly actor_user_id?: string;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly payload?: unknown;
}

export interface ListEventsQuery {
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
}

export interface ProxyOptions {
  readonly auditSvcUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class AuditUpstreamError extends Error {
  readonly httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "AuditUpstreamError";
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

export async function listEvents(
  query: Readonly<ListEventsQuery>,
  opts: Readonly<ProxyOptions>,
): Promise<ReadonlyArray<AuditEvent>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    const qs = new URLSearchParams();
    qs.append("tenant_id", query.tenant_id);
    qs.append("resource_type", query.resource_type);
    qs.append("resource_id", query.resource_id);
    let res: Response;
    try {
      res = await fetchImpl(`${opts.auditSvcUrl}/v1/audit/events?${qs.toString()}`, { signal });
    } catch (err: unknown) {
      throw new AuditUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new AuditUpstreamError(`audit-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as ReadonlyArray<AuditEvent>;
  });
}

export async function appendEvent(
  input: Readonly<CreateAuditEventInput>,
  opts: Readonly<ProxyOptions>,
): Promise<AuditEvent> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.auditSvcUrl}/v1/audit/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new AuditUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new AuditUpstreamError(`audit-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as AuditEvent;
  });
}
