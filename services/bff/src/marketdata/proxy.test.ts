import { describe, it, expect } from "vitest";
import { fetchQuote, MarketDataUpstreamError } from "./proxy.js";

function fakeFetch(handler: (url: string) => { ok: boolean; status: number; body: unknown }): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = handler(url);
    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.body,
    } as Response;
  }) as typeof fetch;
}

describe("fetchQuote", () => {
  it("returns parsed quote on 200", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe("http://localhost:7006/v1/quotes/BTC%2FUSD");
      return { ok: true, status: 200, body: { symbol: "BTC/USD", price: 42345.12 } };
    });

    const got = await fetchQuote("BTC/USD", {
      marketDataSvcUrl: "http://localhost:7006",
      fetchImpl,
    });
    expect(got.symbol).toBe("BTC/USD");
    expect(got.price).toBe(42345.12);
  });

  it("wraps upstream 404 in MarketDataUpstreamError", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 404, body: {} }));
    await expect(
      fetchQuote("DOGE/USD", { marketDataSvcUrl: "http://localhost:7006", fetchImpl }),
    ).rejects.toMatchObject({
      name: "MarketDataUpstreamError",
      httpStatus: 404,
    });
  });

  it("wraps upstream 502 in MarketDataUpstreamError", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 502, body: {} }));
    const err = await fetchQuote("BTC/USD", {
      marketDataSvcUrl: "http://localhost:7006",
      fetchImpl,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MarketDataUpstreamError);
    expect((err as MarketDataUpstreamError).httpStatus).toBe(502);
  });

  it("rejects malformed body shape", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: true, status: 200, body: { wrong: "shape" } }));
    await expect(
      fetchQuote("BTC/USD", { marketDataSvcUrl: "http://localhost:7006", fetchImpl }),
    ).rejects.toThrow(/malformed/);
  });

  it("wraps fetch transport error", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const err = await fetchQuote("BTC/USD", {
      marketDataSvcUrl: "http://localhost:7006",
      fetchImpl,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MarketDataUpstreamError);
    expect((err as Error).message).toContain("ECONNREFUSED");
  });
});
