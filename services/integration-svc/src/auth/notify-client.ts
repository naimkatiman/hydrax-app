export interface NotifyClientConfig {
  notifySvcUrl: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export class NotifyUpstreamError extends Error {
  override readonly name = "NotifyUpstreamError";
  constructor(message: string, public readonly httpStatus: number) {
    super(message);
  }
}

export async function sendEmail(input: SendEmailInput, cfg: NotifyClientConfig): Promise<void> {
  const base = cfg.notifySvcUrl.replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw new NotifyUpstreamError(
      `notify-svc unreachable: ${err instanceof Error ? err.message : String(err)}`,
      0,
    );
  }
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new NotifyUpstreamError(`notify-svc upstream ${res.status}: ${detail}`, res.status);
  }
}
