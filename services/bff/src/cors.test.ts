import { describe, it, expect, vi } from "vitest";
import type http from "node:http";
import { loadCorsConfig, applyCorsHeaders, handlePreflight } from "./cors.js";

function fakeRes() {
  const headers: Record<string, string> = {};
  let writeHeadStatus: number | null = null;
  let ended = false;
  const res = {
    setHeader: vi.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    writeHead: vi.fn((status: number) => {
      writeHeadStatus = status;
    }),
    end: vi.fn(() => {
      ended = true;
    }),
  } as unknown as http.ServerResponse;
  return {
    res,
    headers,
    get status() {
      return writeHeadStatus;
    },
    get ended() {
      return ended;
    },
  };
}

describe("loadCorsConfig", () => {
  it("returns null origin when env var unset", () => {
    expect(loadCorsConfig({})).toEqual({ allowedOrigin: null });
  });

  it("returns null origin when env var is empty/whitespace", () => {
    expect(loadCorsConfig({ BFF_CORS_ALLOWED_ORIGIN: "" })).toEqual({ allowedOrigin: null });
    expect(loadCorsConfig({ BFF_CORS_ALLOWED_ORIGIN: "   " })).toEqual({ allowedOrigin: null });
  });

  it("trims surrounding whitespace from the configured origin", () => {
    expect(
      loadCorsConfig({ BFF_CORS_ALLOWED_ORIGIN: "  https://hydraxrail.up.railway.app  " }),
    ).toEqual({ allowedOrigin: "https://hydraxrail.up.railway.app" });
  });
});

describe("applyCorsHeaders", () => {
  it("is a no-op when CORS is disabled", () => {
    const f = fakeRes();
    applyCorsHeaders(f.res, { allowedOrigin: null });
    expect(f.headers).toEqual({});
  });

  it("sets Access-Control-Allow-Origin and Vary when CORS is enabled", () => {
    const f = fakeRes();
    applyCorsHeaders(f.res, { allowedOrigin: "https://hydraxrail.up.railway.app" });
    expect(f.headers).toEqual({
      "Access-Control-Allow-Origin": "https://hydraxrail.up.railway.app",
      Vary: "Origin",
    });
  });
});

describe("handlePreflight", () => {
  it("returns false and does not write when method is not OPTIONS", () => {
    const f = fakeRes();
    const handled = handlePreflight(
      { method: "GET" } as http.IncomingMessage,
      f.res,
      { allowedOrigin: "https://example.com" },
    );
    expect(handled).toBe(false);
    expect(f.status).toBeNull();
    expect(f.ended).toBe(false);
  });

  it("returns false when CORS is disabled, even on OPTIONS", () => {
    const f = fakeRes();
    const handled = handlePreflight(
      { method: "OPTIONS" } as http.IncomingMessage,
      f.res,
      { allowedOrigin: null },
    );
    expect(handled).toBe(false);
    expect(f.status).toBeNull();
  });

  it("writes 204 with full CORS preflight headers on OPTIONS when enabled", () => {
    const f = fakeRes();
    const handled = handlePreflight(
      { method: "OPTIONS" } as http.IncomingMessage,
      f.res,
      { allowedOrigin: "https://hydraxrail.up.railway.app" },
    );
    expect(handled).toBe(true);
    expect(f.status).toBe(204);
    expect(f.ended).toBe(true);
    expect(f.headers).toEqual({
      "Access-Control-Allow-Origin": "https://hydraxrail.up.railway.app",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
  });
});
