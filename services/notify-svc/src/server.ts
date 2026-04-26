import http from "node:http";
import type { AddressInfo } from "node:net";

import { loadEmailConfig } from "./email-config.js";
import { loadSmtpConfig } from "./smtp-config.js";
import { loadWebhookConfig } from "./webhook-config.js";
import { mountEmailRoutes, type EmailHandlerOptions } from "./email-handlers.js";
import {
  mountWebhookRoutes,
  type WebhookHandlerOptions,
} from "./webhook-handlers.js";
import {
  consoleSender,
  noopSender,
  createSmtpSender,
  type EmailSender,
} from "./email-sender.js";
import {
  createHttpWebhookSender,
  noopWebhookSender,
  type WebhookSender,
} from "./webhook-sender.js";

export interface StartOptions {
  port: number;
  service: string;
  emailEnv?: Record<string, string | undefined>;
  sender?: EmailSender;
  webhookEnv?: Record<string, string | undefined>;
  webhookSender?: WebhookSender;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

function buildSender(env: Record<string, string | undefined>): EmailSender {
  const cfg = loadEmailConfig(env);
  switch (cfg.transport) {
    case "console":
      return consoleSender;
    case "noop":
      return noopSender;
    case "smtp":
      return createSmtpSender(loadSmtpConfig(env));
  }
}

function buildWebhookSender(
  env: Record<string, string | undefined>,
): WebhookSender {
  const cfg = loadWebhookConfig(env);
  switch (cfg.transport) {
    case "noop":
      return noopWebhookSender;
    case "http":
      return createHttpWebhookSender(
        cfg.hmacSecret
          ? { timeoutMs: cfg.timeoutMs, hmacSecret: cfg.hmacSecret }
          : { timeoutMs: cfg.timeoutMs },
      );
  }
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const sender = opts.sender ?? buildSender(opts.emailEnv ?? process.env);
  const webhookSender =
    opts.webhookSender ?? buildWebhookSender(opts.webhookEnv ?? process.env);
  const emailOpts: EmailHandlerOptions = { sender };
  const webhookOpts: WebhookHandlerOptions = { sender: webhookSender };

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    if (mountEmailRoutes(req, res, emailOpts)) return;
    if (mountWebhookRoutes(req, res, webhookOpts)) return;

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 7101);
  const cfg = loadEmailConfig(process.env);
  console.log(`notify-svc: email transport = ${cfg.transport}`);
  if (cfg.transport === "smtp") {
    const smtp = loadSmtpConfig(process.env);
    console.log(`notify-svc: smtp host=${smtp.host} port=${smtp.port} secure=${smtp.secure} from=${smtp.from} auth=${smtp.user ? "yes" : "no"}`);
  }
  const webhookCfg = loadWebhookConfig(process.env);
  console.log(
    `notify-svc: webhook transport=${webhookCfg.transport} timeoutMs=${webhookCfg.timeoutMs} hmac=${webhookCfg.hmacSecret ? "yes" : "no"}`,
  );
  startServer({ port, service: "notify-svc" }).then(({ baseUrl }) => {
    console.log(`notify-svc listening on ${baseUrl}`);
  });
}
