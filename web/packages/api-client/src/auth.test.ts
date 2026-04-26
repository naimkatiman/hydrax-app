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
