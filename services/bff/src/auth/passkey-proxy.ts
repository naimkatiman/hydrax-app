import { AuthUpstreamError, type AuthUpstreamConfig } from "./proxy.js";

export interface PasskeyOptionsBody {
  challenge: string;
  [key: string]: unknown;  // remainder is library-defined and forwarded as-is to browser
}

export interface PasskeyAuthOptionsBody extends PasskeyOptionsBody {
  allowCredentials?: Array<{ id: string; transports?: string[] }>;
}

export interface AuthOptionsInput {
  tenant_slug: string;
  email: string;
}

export interface AuthVerifyInput {
  tenant_slug: string;
  email: string;
  response: Record<string, unknown>;
}

export interface RegisterVerifyInput {
  response: Record<string, unknown>;
}

export interface VerifyResult {
  verified: boolean;
}

export interface SessionResult {
  token: string;
  session: {
    id: string;
    user_id: string;
    tenant_id: string;
    role: string;
    expires_at: string;
  };
}

async function readJsonOrThrow(res: Response, errLabel: string): Promise<unknown> {
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new AuthUpstreamError(`${errLabel}: upstream ${res.status}: ${detail}`, res.status);
  }
  return res.json();
}

export async function proxyPasskeyRegisterOptions(
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<PasskeyOptionsBody> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/passkeys/register/options`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  return (await readJsonOrThrow(res, "passkey_register_options")) as PasskeyOptionsBody;
}

export async function proxyPasskeyRegisterVerify(
  input: RegisterVerifyInput,
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<VerifyResult> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/passkeys/register/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  return (await readJsonOrThrow(res, "passkey_register_verify")) as VerifyResult;
}

export async function proxyPasskeyAuthOptions(
  input: AuthOptionsInput,
  cfg: AuthUpstreamConfig,
): Promise<PasskeyAuthOptionsBody> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/passkeys/auth/options`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await readJsonOrThrow(res, "passkey_auth_options")) as PasskeyAuthOptionsBody;
}

export async function proxyPasskeyAuthVerify(
  input: AuthVerifyInput,
  cfg: AuthUpstreamConfig,
): Promise<SessionResult> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/passkeys/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await readJsonOrThrow(res, "passkey_auth_verify")) as SessionResult;
}
