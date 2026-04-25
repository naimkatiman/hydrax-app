export interface Product {
  readonly id: string;
  readonly tenant_id: string;
  readonly code: string;
  readonly name: string;
  readonly product_type: string;
  readonly status: string;
  readonly rails_product_id?: string;
  readonly allowed_next?: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateProductInput {
  readonly tenant_id: string;
  readonly code: string;
  readonly name: string;
  readonly product_type: string;
}

export interface ListProductsArgs {
  readonly tenantId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListProductsResponse {
  readonly products: ReadonlyArray<Product>;
  readonly next_offset: number | null;
}

export interface TransitionProductInput {
  readonly to: string;
}

export interface ProxyOptions {
  readonly workflowSvcUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class ProductsUpstreamError extends Error {
  readonly httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "ProductsUpstreamError";
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

export async function listProducts(
  args: Readonly<ListProductsArgs>,
  opts: Readonly<ProxyOptions>,
): Promise<ListProductsResponse> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  const params = new URLSearchParams({ tenant_id: args.tenantId });
  if (args.limit !== undefined) params.set("limit", String(args.limit));
  if (args.offset !== undefined) params.set("offset", String(args.offset));
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.workflowSvcUrl}/v1/products?${params.toString()}`, { signal });
    } catch (err: unknown) {
      throw new ProductsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ProductsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch (err: unknown) {
      throw new ProductsUpstreamError(
        err instanceof Error ? `malformed body: ${err.message}` : "malformed body",
        res.status,
      );
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !Array.isArray((body as { products?: unknown }).products)
    ) {
      throw new ProductsUpstreamError("malformed body: missing products array", res.status);
    }
    return body as ListProductsResponse;
  });
}

export async function fetchProduct(id: string, opts: Readonly<ProxyOptions>): Promise<Product> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.workflowSvcUrl}/v1/products/${encodeURIComponent(id)}`, { signal });
    } catch (err: unknown) {
      throw new ProductsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ProductsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Product;
  });
}

export async function createProduct(input: Readonly<CreateProductInput>, opts: Readonly<ProxyOptions>): Promise<Product> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.workflowSvcUrl}/v1/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new ProductsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ProductsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Product;
  });
}

export async function transitionProduct(
  id: string,
  input: Readonly<TransitionProductInput>,
  opts: Readonly<ProxyOptions>,
): Promise<Product> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(
        `${opts.workflowSvcUrl}/v1/products/${encodeURIComponent(id)}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal,
        },
      );
    } catch (err: unknown) {
      throw new ProductsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ProductsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Product;
  });
}
