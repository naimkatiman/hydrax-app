export interface Approval {
  readonly id: string;
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly decided_by_user_id?: string;
  readonly decided_at?: string;
  readonly created_at: string;
}

export interface CreateApprovalInput {
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
}

export interface DecideApprovalInput {
  readonly status: "approved" | "rejected";
  readonly decided_by_user_id: string;
}

export interface ProxyOptions {
  readonly approvalSvcUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class ApprovalsUpstreamError extends Error {
  readonly httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "ApprovalsUpstreamError";
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

export async function listPendingApprovals(
  opts: Readonly<ProxyOptions>,
): Promise<ReadonlyArray<Approval>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.approvalSvcUrl}/v1/approvals`, { signal });
    } catch (err: unknown) {
      throw new ApprovalsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ApprovalsUpstreamError(`approval-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as ReadonlyArray<Approval>;
  });
}

export async function fetchApproval(
  id: string,
  opts: Readonly<ProxyOptions>,
): Promise<Approval> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.approvalSvcUrl}/v1/approvals/${encodeURIComponent(id)}`, { signal });
    } catch (err: unknown) {
      throw new ApprovalsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ApprovalsUpstreamError(`approval-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Approval;
  });
}

export async function createApproval(
  input: Readonly<CreateApprovalInput>,
  opts: Readonly<ProxyOptions>,
): Promise<Approval> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.approvalSvcUrl}/v1/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new ApprovalsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ApprovalsUpstreamError(`approval-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Approval;
  });
}

export async function decideApproval(
  id: string,
  input: Readonly<DecideApprovalInput>,
  opts: Readonly<ProxyOptions>,
): Promise<Approval> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.approvalSvcUrl}/v1/approvals/${encodeURIComponent(id)}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new ApprovalsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ApprovalsUpstreamError(`approval-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Approval;
  });
}
