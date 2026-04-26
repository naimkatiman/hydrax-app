import http from "node:http";
import type { AddressInfo } from "node:net";

import { loadEmailConfig } from "./email-config.js";
import { mountEmailRoutes, type EmailHandlerOptions } from "./email-handlers.js";

export interface StartOptions {
  port: number;
  service: string;
  emailEnv?: Record<string, string | undefined>;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const emailConfig = loadEmailConfig(opts.emailEnv ?? process.env);
  const emailOpts: EmailHandlerOptions = { transport: emailConfig.transport };

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    if (mountEmailRoutes(req, res, emailOpts)) return;

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
  startServer({ port, service: "notify-svc" }).then(({ baseUrl }) => {
    console.log(`notify-svc listening on ${baseUrl}`);
  });
}
