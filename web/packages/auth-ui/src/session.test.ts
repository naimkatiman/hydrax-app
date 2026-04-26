import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { TokenStorage } from "@hydrax/api-client";
import { useSession } from "./session";

const sessionFixture = {
  session_id: "s1",
  user_id: "u1",
  tenant_id: "t1",
  tenant_slug: "acme",
  email: "alice@acme.test",
  role: "investor",
  expires_at: "2026-12-31T00:00:00Z",
};

function makeStorage(initial: string | null = null): TokenStorage & { peek: () => string | null } {
  let value = initial;
  return {
    get: () => value,
    set: (token: string) => {
      value = token;
    },
    clear: () => {
      value = null;
    },
    peek: () => value,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("useSession", () => {
  it("returns unauthenticated when no token in storage and never calls whoami", async () => {
    const fetchMock = vi.fn();
    const storage = makeStorage(null);
    const { result } = renderHook(() =>
      useSession({ bffUrl: "http://test", fetch: fetchMock, storage }),
    );
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.session).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads session from whoami when token is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(sessionFixture, 200));
    const storage = makeStorage("token-abc");
    const { result } = renderHook(() =>
      useSession({ bffUrl: "http://test", fetch: fetchMock, storage }),
    );
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.session).toEqual(sessionFixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("http://test/v1/auth/whoami");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer token-abc" });
  });

  it("clears the token and reports unauthenticated when whoami returns 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "expired" }, 401));
    const storage = makeStorage("stale-token");
    const { result } = renderHook(() =>
      useSession({ bffUrl: "http://test", fetch: fetchMock, storage }),
    );
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.session).toBeNull();
    expect(storage.peek()).toBeNull();
  });

  it("does NOT clear the token on a non-401 whoami error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    const storage = makeStorage("keep-me");
    const { result } = renderHook(() =>
      useSession({ bffUrl: "http://test", fetch: fetchMock, storage }),
    );
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(storage.peek()).toBe("keep-me");
  });

  it("signOut posts to /v1/auth/logout, clears storage, and resets state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionFixture, 200))
      .mockResolvedValueOnce(jsonResponse({}, 204));
    const storage = makeStorage("token-active");
    const { result } = renderHook(() =>
      useSession({ bffUrl: "http://test", fetch: fetchMock, storage }),
    );
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.session).toBeNull();
    expect(storage.peek()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [logoutUrl, logoutInit] = fetchMock.mock.calls[1];
    expect(logoutUrl).toBe("http://test/v1/auth/logout");
    expect((logoutInit as RequestInit).method).toBe("POST");
  });

  it("signOut still clears local state when logout endpoint returns non-2xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionFixture, 200))
      .mockResolvedValueOnce(jsonResponse({ error: "logout failed" }, 500));
    const storage = makeStorage("token-active");
    const { result } = renderHook(() =>
      useSession({ bffUrl: "http://test", fetch: fetchMock, storage }),
    );
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(storage.peek()).toBeNull();
  });
});
