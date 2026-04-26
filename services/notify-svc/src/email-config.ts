export type EmailTransport = "console" | "noop" | "smtp";

export interface EmailConfig {
  transport: EmailTransport;
}

const SUPPORTED: ReadonlyArray<EmailTransport> = ["console", "noop", "smtp"];

export function loadEmailConfig(env: Record<string, string | undefined>): EmailConfig {
  const raw = env.EMAIL_TRANSPORT;
  if (raw === undefined || raw === "") return { transport: "console" };
  if (!SUPPORTED.includes(raw as EmailTransport)) {
    throw new Error(
      `EMAIL_TRANSPORT unsupported: '${raw}' (supported: ${SUPPORTED.join(", ")})`,
    );
  }
  return { transport: raw as EmailTransport };
}
