export interface TokenStorage {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

export interface AuthClientOptions {
  bffUrl: string;
  storage: TokenStorage;
  fetch?: typeof fetch;
}

export interface WhoamiResult {
  session_id: string;
  user_id: string;
  tenant_id: string;
  tenant_slug: string;
  email: string;
  role: string;
  expires_at: string;
}

export class AuthClientError extends Error {
  override readonly name = "AuthClientError";
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface AuthClient {
  whoami(): Promise<WhoamiResult>;
  logout(): Promise<void>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  storage: TokenStorage;
}

export function createAuthClient(opts: AuthClientOptions): AuthClient {
  const f = opts.fetch ?? fetch;
  const url = (path: string): string => `${opts.bffUrl}${path}`;

  return {
    storage: opts.storage,
    async whoami() {
      const token = opts.storage.get();
      if (!token) throw new AuthClientError("no token in storage");
      const res = await f(url("/v1/auth/whoami"), {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new AuthClientError(`whoami failed: ${res.status}`, res.status);
      return (await res.json()) as WhoamiResult;
    },
    async logout() {
      const token = opts.storage.get();
      try {
        if (token) {
          await f(url("/v1/auth/logout"), {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
          });
        }
      } finally {
        opts.storage.clear();
      }
    },
    async fetch(path, init) {
      const token = opts.storage.get();
      const baseHeaders = init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : (init?.headers as Record<string, string> | undefined) ?? {};
      const headers: Record<string, string> = { ...baseHeaders };
      if (token) headers["authorization"] = `Bearer ${token}`;
      return f(url(path), { ...init, headers });
    },
  };
}

export const localStorageTokenStorage: TokenStorage = {
  get() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("hydrax.session.token");
  },
  set(token) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("hydrax.session.token", token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("hydrax.session.token");
  },
};
