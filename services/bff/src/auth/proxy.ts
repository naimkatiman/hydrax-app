export interface AuthUpstreamConfig {
  integrationSvcUrl: string;
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

export class AuthUpstreamError extends Error {
  override readonly name = "AuthUpstreamError";
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
  }
}

async function readJsonOrThrow(res: Response, errLabel: string): Promise<unknown> {
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore read errors
    }
    throw new AuthUpstreamError(
      `${errLabel}: upstream ${res.status}: ${detail}`,
      res.status,
    );
  }
  return res.json();
}

export async function proxyWhoami(
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<WhoamiResult> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/whoami`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return (await readJsonOrThrow(res, "whoami")) as WhoamiResult;
}

export async function proxyLogout(
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<void> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/logout`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new AuthUpstreamError(`logout: upstream ${res.status}`, res.status);
  }
}
