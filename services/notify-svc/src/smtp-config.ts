export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure: boolean;
  from: string;
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

export function loadSmtpConfig(env: Record<string, string | undefined>): SmtpConfig {
  const host = env.SMTP_HOST;
  if (!host) {
    throw new Error("SMTP_HOST is required when EMAIL_TRANSPORT=smtp");
  }
  const port = readBoundedInt(env.SMTP_PORT, "SMTP_PORT", 587, 1, 65535);

  const user = env.SMTP_USER || undefined;
  const pass = env.SMTP_PASS || undefined;
  if ((user && !pass) || (!user && pass)) {
    throw new Error("SMTP_USER and SMTP_PASS must be set together (or both unset)");
  }

  // SMTP_SECURE: explicit boolean, or auto-detect from port (465 = TLS implicit).
  let secure: boolean;
  const rawSecure = env.SMTP_SECURE;
  if (rawSecure === undefined || rawSecure === "") {
    secure = port === 465;
  } else if (rawSecure === "true" || rawSecure === "1") {
    secure = true;
  } else if (rawSecure === "false" || rawSecure === "0") {
    secure = false;
  } else {
    throw new Error(`SMTP_SECURE must be 'true' or 'false', got ${rawSecure}`);
  }

  const from = env.SMTP_FROM || "noreply@hydrax.local";

  return { host, port, user, pass, secure, from };
}
