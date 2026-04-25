// Thin proxy from BFF to market-data-svc for the React portals.
// Today this just forwards GET /v1/quotes/{symbol} → market-data-svc on
// the same shape — no transformation, no aggregation. When portals need
// composite views (e.g. quote + last 24h candles in one shot) those land
// here as new methods rather than new market-data-svc routes.

export interface QuoteResponse {
  symbol: string;
  price: number;
}

export interface ProxyOptions {
  marketDataSvcUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class MarketDataUpstreamError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "MarketDataUpstreamError";
  }
}

export async function fetchQuote(
  symbol: string,
  opts: Readonly<ProxyOptions>,
): Promise<QuoteResponse> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${opts.marketDataSvcUrl}/v1/quotes/${encodeURIComponent(symbol)}`;
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      throw new MarketDataUpstreamError(
        `market-data-svc returned ${res.status}`,
        res.status,
      );
    }
    const body = (await res.json()) as unknown;
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).symbol !== "string" ||
      typeof (body as Record<string, unknown>).price !== "number"
    ) {
      throw new MarketDataUpstreamError("market-data-svc returned malformed body");
    }
    const parsed = body as Record<string, unknown>;
    return { symbol: parsed.symbol as string, price: parsed.price as number };
  } catch (err: unknown) {
    if (err instanceof MarketDataUpstreamError) {
      throw err;
    }
    throw new MarketDataUpstreamError(
      err instanceof Error ? err.message : "unknown",
    );
  } finally {
    clearTimeout(timer);
  }
}
