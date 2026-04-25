export interface MagicLinkConfig {
  ttlSeconds: number;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
  baseUrl: string;
}

function readBoundedInt(
  raw: string | undefined,
  name: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${name} must be a positive integer, got ${raw}`);
  }
  if (parsed < min) throw new Error(`${name} must be >= ${min} (got ${parsed})`);
  if (parsed > max) throw new Error(`${name} must be <= ${max} (got ${parsed})`);
  return parsed;
}

export function loadMagicLinkConfig(env: Record<string, string | undefined>): MagicLinkConfig {
  const ttlSeconds = readBoundedInt(env.MAGIC_LINK_TTL_SECONDS, "MAGIC_LINK_TTL_SECONDS", 900, 60, 3600);
  const rateLimitMax = readBoundedInt(env.MAGIC_LINK_RATE_LIMIT_PER_WINDOW, "MAGIC_LINK_RATE_LIMIT_PER_WINDOW", 3, 1, 10);
  const rateLimitWindowSeconds = readBoundedInt(env.MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS, "MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS", 900, 60, 3600);

  const rawBase = env.MAGIC_LINK_BASE_URL ?? "http://localhost:5173/auth/magic-link";
  const baseUrl = rawBase.replace(/\/+$/, "");

  return { ttlSeconds, rateLimitMax, rateLimitWindowSeconds, baseUrl };
}
