import { describe, it, expect, vi } from "vitest";
import type http from "node:http";
import { loadCorsConfig, applyCorsHeaders, handlePreflight, pickAllowedOrigin } from "./cors.js";

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

function reqWithOrigin(origin?: string, method: string = "GET"): http.IncomingMessage {
  return { method, headers: origin ? { origin } : {} } as unknown as http.IncomingMessage;
}

describe("loadCorsConfig", () => {
  it("returns empty allowlist when env var unset", () => {
    expect(loadCorsConfig({})).toEqual({ allowedOrigins: [] });
  });

  it("returns empty allowlist when env var is empty/whitespace", () => {
    expect(loadCorsConfig({ BFF_CORS_ALLOWED_ORIGIN: "" })).toEqual({ allowedOrigins: [] });
    expect(loadCorsConfig({ BFF_CORS_ALLOWED_ORIGIN: "   " })).toEqual({ allowedOrigins: [] });
    expect(loadCorsConfig({ BFF_CORS_ALLOWED_ORIGIN: " , , " })).toEqual({ allowedOrigins: [] });
  });

  it("parses a single origin (backward compat with the original loader)", () => {
    expect(
      loadCorsConfig({ BFF_CORS_ALLOWED_ORIGIN: "  https://hydraxrail.up.railway.app  " }),
    ).toEqual({ allowedOrigins: ["https://hydraxrail.up.railway.app"] });
  });

  it("parses a comma-separated allowlist with whitespace trimmed per entry", () => {
    expect(
      loadCorsConfig({
        BFF_CORS_ALLOWED_ORIGIN: " https://hydraxrail.com , https://hydraxrail.up.railway.app ",
      }),
    ).toEqual({
      allowedOrigins: ["https://hydraxrail.com", "https://hydraxrail.up.railway.app"],
    });
  });

  it("discards empty entries between commas", () => {
    expect(
      loadCorsConfig({
        BFF_CORS_ALLOWED_ORIGIN: "https://hydraxrail.com,,https://hydraxrail.up.railway.app,",
      }),
    ).toEqual({
      allowedOrigins: ["https://hydraxrail.com", "https://hydraxrail.up.railway.app"],
    });
  });
});

describe("pickAllowedOrigin", () => {
  const config = {
    allowedOrigins: ["https://hydraxrail.com", "https://hydraxrail.up.railway.app"],
  };

  it("returns null when allowlist is empty", () => {
    expect(pickAllowedOrigin(reqWithOrigin("https://hydraxrail.com"), { allowedOrigins: [] })).toBeNull();
  });

  it("returns null when request has no Origin header", () => {
    expect(pickAllowedOrigin(reqWithOrigin(), config)).toBeNull();
  });

  it("returns the matched origin when listed", () => {
    expect(pickAllowedOrigin(reqWithOrigin("https://hydraxrail.com"), config)).toBe(
      "https://hydraxrail.com",
    );
    expect(
      pickAllowedOrigin(reqWithOrigin("https://hydraxrail.up.railway.app"), config),
    ).toBe("https://hydraxrail.up.railway.app");
  });

  it("returns null for an unlisted origin", () => {
    expect(pickAllowedOrigin(reqWithOrigin("https://attacker.example"), config)).toBeNull();
  });

  it("is case-sensitive on the origin value (spec-compliant opaque-string compare)", () => {
    expect(pickAllowedOrigin(reqWithOrigin("https://HYDRAXRAIL.COM"), config)).toBeNull();
  });
});

describe("applyCorsHeaders", () => {
  it("is a no-op when CORS is disabled", () => {
    const f = fakeRes();
    applyCorsHeaders(reqWithOrigin("https://hydraxrail.com"), f.res, { allowedOrigins: [] });
    expect(f.headers).toEqual({});
  });

  it("is a no-op when the inbound Origin is not on the allowlist", () => {
    const f = fakeRes();
    applyCorsHeaders(reqWithOrigin("https://attacker.example"), f.res, {
      allowedOrigins: ["https://hydraxrail.com"],
    });
    expect(f.headers).toEqual({});
  });

  it("echoes only the matched origin (never wildcards) when the inbound Origin is allowed", () => {
    const f = fakeRes();
    applyCorsHeaders(reqWithOrigin("https://hydraxrail.com"), f.res, {
      allowedOrigins: ["https://hydraxrail.com", "https://hydraxrail.up.railway.app"],
    });
    expect(f.headers).toEqual({
      "Access-Control-Allow-Origin": "https://hydraxrail.com",
      Vary: "Origin",
    });
  });

  it("echoes the legacy Railway origin when the request comes from there (cutover safety)", () => {
    const f = fakeRes();
    applyCorsHeaders(reqWithOrigin("https://hydraxrail.up.railway.app"), f.res, {
      allowedOrigins: ["https://hydraxrail.com", "https://hydraxrail.up.railway.app"],
    });
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
      reqWithOrigin("https://hydraxrail.com", "GET"),
      f.res,
      { allowedOrigins: ["https://hydraxrail.com"] },
    );
    expect(handled).toBe(false);
    expect(f.status).toBeNull();
    expect(f.ended).toBe(false);
  });

  it("returns false when CORS is disabled, even on OPTIONS", () => {
    const f = fakeRes();
    const handled = handlePreflight(
      reqWithOrigin("https://hydraxrail.com", "OPTIONS"),
      f.res,
      { allowedOrigins: [] },
    );
    expect(handled).toBe(false);
    expect(f.status).toBeNull();
  });

  it("writes 204 with full preflight headers + matched origin when the origin is allowed", () => {
    const f = fakeRes();
    const handled = handlePreflight(
      reqWithOrigin("https://hydraxrail.com", "OPTIONS"),
      f.res,
      { allowedOrigins: ["https://hydraxrail.com", "https://hydraxrail.up.railway.app"] },
    );
    expect(handled).toBe(true);
    expect(f.status).toBe(204);
    expect(f.ended).toBe(true);
    expect(f.headers).toEqual({
      "Access-Control-Allow-Origin": "https://hydraxrail.com",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
  });

  it("writes 204 WITHOUT Allow-Origin when the origin is foreign — browser will reject the actual request", () => {
    const f = fakeRes();
    const handled = handlePreflight(
      reqWithOrigin("https://attacker.example", "OPTIONS"),
      f.res,
      { allowedOrigins: ["https://hydraxrail.com"] },
    );
    expect(handled).toBe(true);
    expect(f.status).toBe(204);
    expect(f.headers).toEqual({
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
  });
});
