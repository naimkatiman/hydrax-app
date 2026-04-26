export type EmailTransport = "console" | "noop";

export interface EmailConfig {
  transport: EmailTransport;
}

const SUPPORTED: ReadonlyArray<EmailTransport> = ["console", "noop"];

export function loadEmailConfig(env: Record<string, string | undefined>): EmailConfig {
  const raw = env.EMAIL_TRANSPORT;
  if (raw === undefined || raw === "") return { transport: "console" };
  if (!SUPPORTED.includes(raw as EmailTransport)) {
    throw new Error(
      `EMAIL_TRANSPORT unsupported: '${raw}' (supported: ${SUPPORTED.join(", ")}; slice 2c will add smtp/ses/resend)`,
    );
  }
  return { transport: raw as EmailTransport };
}
