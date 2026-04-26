import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AuthClientError,
  createAuthClient,
  localStorageTokenStorage,
  type TokenStorage,
  type WhoamiResult,
} from "@hydrax/api-client";

type ViteEnv = { readonly VITE_BFF_URL?: string };

function readBffUrl(): string {
  const viteEnv = (import.meta as { env?: ViteEnv }).env;
  if (viteEnv?.VITE_BFF_URL) return viteEnv.VITE_BFF_URL;
  if (typeof process !== "undefined" && process.env.VITE_BFF_URL) {
    return process.env.VITE_BFF_URL;
  }
  return "http://localhost:8080";
}

const DEFAULT_BFF_URL = readBffUrl();

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface UseSessionOptions {
  readonly bffUrl?: string;
  readonly fetch?: typeof fetch;
  readonly storage?: TokenStorage;
}

export interface UseSessionResult {
  readonly session: WhoamiResult | null;
  readonly status: SessionStatus;
  readonly signOut: () => Promise<void>;
}

export function useSession(opts: UseSessionOptions = {}): UseSessionResult {
  const bffUrl = opts.bffUrl ?? DEFAULT_BFF_URL;
  const storage = opts.storage ?? localStorageTokenStorage;
  const fetchImpl = opts.fetch;

  const client = useMemo(
    () =>
      createAuthClient({
        bffUrl,
        storage,
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
      }),
    [bffUrl, storage, fetchImpl],
  );

  const [session, setSession] = useState<WhoamiResult | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  useEffect(() => {
    const token = client.storage.get();
    if (!token) {
      setSession(null);
      setStatus("unauthenticated");
      return;
    }
    let cancelled = false;
    client
      .whoami()
      .then((result) => {
        if (cancelled) return;
        setSession(result);
        setStatus("authenticated");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof AuthClientError && err.status === 401) {
          client.storage.clear();
        }
        setSession(null);
        setStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const signOut = useCallback(async () => {
    try {
      await client.logout();
    } finally {
      setSession(null);
      setStatus("unauthenticated");
    }
  }, [client]);

  return { session, status, signOut };
}
