export interface PasskeyConfig {
  rpID: string;
  rpName: string;
  origin: string;
  challengeTtlSeconds: number;
}

export function loadPasskeyConfig(env: Record<string, string | undefined>): PasskeyConfig {
  const ttlRaw = env.WEBAUTHN_CHALLENGE_TTL_SECONDS;
  let challengeTtlSeconds = 60;
  if (ttlRaw !== undefined && ttlRaw !== "") {
    const parsed = Number(ttlRaw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new Error(`WEBAUTHN_CHALLENGE_TTL_SECONDS must be a positive integer, got ${ttlRaw}`);
    }
    if (parsed < 30) throw new Error(`WEBAUTHN_CHALLENGE_TTL_SECONDS must be >= 30 (got ${parsed})`);
    if (parsed > 300) throw new Error(`WEBAUTHN_CHALLENGE_TTL_SECONDS must be <= 300 (got ${parsed})`);
    challengeTtlSeconds = parsed;
  }

  return {
    rpID: env.WEBAUTHN_RP_ID || "localhost",
    rpName: env.WEBAUTHN_RP_NAME || "Hydrax",
    origin: env.WEBAUTHN_ORIGIN || "http://localhost:5173",
    challengeTtlSeconds,
  };
}
