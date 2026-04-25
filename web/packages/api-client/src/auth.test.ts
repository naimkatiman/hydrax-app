import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuthClient, type TokenStorage } from "./auth.js";

function memoryStorage(): TokenStorage {
  let value: string | null = null;
  return {
    get: () => value,
    set: (v) => { value = v; },
    clear: () => { value = null; },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("createAuthClient", () => {
  it("login POSTs body and stores token on success", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      token: "T", session: { id: "s", user_id: "U", tenant_id: "X", role: "admin", expires_at: "2030-01-01T00:00:00Z" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const storage = memoryStorage();
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock as unknown as typeof fetch });
    const result = await client.login({ tenantSlug: "t", email: "e@x.test" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://bff/v1/auth/dev/login",
      expect.objectContaining({ method: "POST" }),
    );
    expect(storage.get()).toBe("T");
    expect(result.session.user_id).toBe("U");
  });

  it("login throws on non-2xx and does NOT store token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 401 }));
    const storage = memoryStorage();
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock as unknown as typeof fetch });
    await expect(client.login({ tenantSlug: "t", email: "e@x.test" })).rejects.toThrow();
    expect(storage.get()).toBeNull();
  });

  it("whoami sends Authorization header from storage", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      session_id: "s", user_id: "U", tenant_id: "T", tenant_slug: "t", email: "e", role: "admin",
      expires_at: "2030-01-01T00:00:00Z",
    }), { status: 200 }));
    const storage = memoryStorage();
    storage.set("T");
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock as unknown as typeof fetch });
    const me = await client.whoami();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://bff/v1/auth/whoami",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer T" }) }),
    );
    expect(me.user_id).toBe("U");
  });

  it("whoami throws if no token in storage", async () => {
    const client = createAuthClient({ bffUrl: "http://bff", storage: memoryStorage(), fetch: vi.fn() as unknown as typeof fetch });
    await expect(client.whoami()).rejects.toThrow();
  });

  it("logout calls bff and clears storage even on error", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const storage = memoryStorage();
    storage.set("T");
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock as unknown as typeof fetch });
    await client.logout();
    expect(storage.get()).toBeNull();
  });

  it("withAuth wraps fetch and adds Authorization header", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const storage = memoryStorage();
    storage.set("T");
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock as unknown as typeof fetch });
    await client.fetch("/v1/products/abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://bff/v1/products/abc",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer T" }) }),
    );
  });
});
