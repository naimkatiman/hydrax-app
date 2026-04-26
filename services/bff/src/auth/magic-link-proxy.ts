import { AuthUpstreamError, type AuthUpstreamConfig } from "./proxy.js";

export interface MagicLinkRequestInput {
  tenant_slug: string;
  email: string;
}

export interface MagicLinkSessionResult {
  token: string;
  session: {
    id: string;
    user_id: string;
    tenant_id: string;
    tenant_slug: string;
    email: string;
    role: string;
    expires_at: string;
  };
}

export async function proxyMagicLinkRequest(
  input: MagicLinkRequestInput,
  cfg: AuthUpstreamConfig,
): Promise<void> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/magic-link/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new AuthUpstreamError(`magic_link_request: upstream ${res.status}: ${detail}`, res.status);
  }
}

export async function proxyMagicLinkConsume(
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<MagicLinkSessionResult> {
  const url = `${cfg.integrationSvcUrl}/v1/auth/magic-link/consume?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new AuthUpstreamError(`magic_link_consume: upstream ${res.status}: ${detail}`, res.status);
  }
  return (await res.json()) as MagicLinkSessionResult;
}
