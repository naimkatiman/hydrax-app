import nodemailer, { type Transporter } from "nodemailer";

import type { SmtpConfig } from "./smtp-config.js";

export interface EmailEnvelope {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(envelope: EmailEnvelope): Promise<void>;
}

/** Logs the envelope to stdout. Slice 2b's default. */
export const consoleSender: EmailSender = {
  async send({ to, subject, text }) {
    console.log(`[notify-svc:email] To: ${to} | Subject: ${subject} | Text: ${text}`);
  },
};

/** Drops the envelope on the floor. Useful for load tests + CI without log noise. */
export const noopSender: EmailSender = {
  async send() { /* intentionally empty */ },
};

/**
 * createSmtpSender builds a sender backed by a nodemailer Transporter.
 * The transporter factory is injected so tests can mock it without
 * spinning up a real SMTP server. Production callers pass
 * defaultSmtpTransporterFactory (uses nodemailer.createTransport).
 */
export function createSmtpSender(
  cfg: SmtpConfig,
  factory: SmtpTransporterFactory = defaultSmtpTransporterFactory,
): EmailSender {
  const transporter = factory(cfg);
  const fromAddress = cfg.from;
  return {
    async send({ to, subject, text }) {
      await transporter.sendMail({ from: fromAddress, to, subject, text });
    },
  };
}

export interface SmtpSendInput {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface SmtpTransporterLike {
  sendMail(input: SmtpSendInput): Promise<unknown>;
}

export type SmtpTransporterFactory = (cfg: SmtpConfig) => SmtpTransporterLike;

export const defaultSmtpTransporterFactory: SmtpTransporterFactory = (cfg) => {
  const transporter: Transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  return {
    sendMail: (input) => transporter.sendMail(input),
  };
};
