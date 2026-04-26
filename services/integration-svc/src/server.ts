import http from "node:http";
import type { AddressInfo } from "node:net";

import { openPool, redactDsn, type Pool } from "./db.js";
import { mountAuthRoutes, type AuthHandlerOptions } from "./auth/handlers.js";
import { Sessions } from "./auth/repo.js";
import { Passkeys } from "./auth/passkey-repo.js";
import { createChallengeStore } from "./auth/challenge-store.js";
import { loadPasskeyConfig } from "./auth/passkey-config.js";
import { mountPasskeyRoutes, type PasskeyHandlerOptions } from "./auth/passkey-handlers.js";
import { MagicLinks } from "./auth/magic-link-repo.js";
import { createRateLimit } from "./auth/magic-link-rate-limit.js";
import { loadMagicLinkConfig } from "./auth/magic-link-config.js";
import { sendEmail } from "./auth/notify-client.js";
import { mountMagicLinkRoutes, type MagicLinkHandlerOptions } from "./auth/magic-link-handlers.js";

export interface StartOptions {
  port: number;
  service: string;
  pool?: Pool;
  devLoginEnabled?: boolean;
  ttlSeconds?: number;
  passkeyEnv?: Record<string, string | undefined>;
  magicLinkEnv?: Record<string, string | undefined>;
  notifySvcUrl?: string;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const ttlSeconds = opts.ttlSeconds ?? 60 * 60 * 12;

  const authOpts: AuthHandlerOptions | null = opts.pool
    ? { repo: new Sessions(opts.pool), ttlSeconds, devLoginEnabled: opts.devLoginEnabled ?? false }
    : null;

  const passkeyOpts: PasskeyHandlerOptions | null = opts.pool
    ? {
        sessions: new Sessions(opts.pool),
        passkeys: new Passkeys(opts.pool),
        challenges: createChallengeStore({ ttlSeconds: 60, maxEntries: 10_000 }),
        config: loadPasskeyConfig(opts.passkeyEnv ?? process.env),
        sessionTtlSeconds: ttlSeconds,
      }
    : null;

  const magicLinkOpts: MagicLinkHandlerOptions | null = opts.pool
    ? (() => {
        const cfg = loadMagicLinkConfig(opts.magicLinkEnv ?? process.env);
        return {
          sessions: new Sessions(opts.pool!),
          magicLinks: new MagicLinks(opts.pool!),
          rateLimit: createRateLimit({
            max: cfg.rateLimitMax,
            windowSeconds: cfg.rateLimitWindowSeconds,
            maxBuckets: 10_000,
          }),
          notifyClient: { sendEmail },
          notifyConfig: { notifySvcUrl: opts.notifySvcUrl ?? process.env.NOTIFY_SVC_URL ?? "http://localhost:7101" },
          config: cfg,
          sessionTtlSeconds: ttlSeconds,
        };
      })()
    : null;

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    if (authOpts && mountAuthRoutes(req, res, authOpts)) return;
    if (passkeyOpts && mountPasskeyRoutes(req, res, passkeyOpts)) return;
    if (magicLinkOpts && mountMagicLinkRoutes(req, res, magicLinkOpts)) return;

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
  const port = Number(process.env.PORT ?? 7102);
  const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "1";
  const ttlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 12);

  const pool = dsn ? openPool({ connectionString: dsn }) : undefined;
  if (!dsn) {
    console.warn(
      "integration-svc: INTEGRATION_SVC_DATABASE_URL/DATABASE_URL unset — auth + magic-link routes disabled, only /healthz served",
    );
  } else {
    console.log(`integration-svc: DB pool ready (${redactDsn(dsn)})`);
    if (!devLoginEnabled) {
      console.log("integration-svc: AUTH_DEV_LOGIN!=1 — dev/login disabled (returns 404)");
    }
    const passkey = loadPasskeyConfig(process.env);
    console.log(`integration-svc: passkey RP=${passkey.rpID}, origin=${passkey.origin}`);
    const ml = loadMagicLinkConfig(process.env);
    console.log(`integration-svc: magic-link TTL=${ml.ttlSeconds}s, rate=${ml.rateLimitMax}/${ml.rateLimitWindowSeconds}s, baseUrl=${ml.baseUrl}`);
    console.log(`integration-svc: notify-svc URL = ${process.env.NOTIFY_SVC_URL ?? "http://localhost:7101"}`);
  }

  startServer({ port, service: "integration-svc", pool, devLoginEnabled, ttlSeconds }).then(
    ({ baseUrl }) => {
      console.log(`integration-svc listening on ${baseUrl}`);
    },
  );
}
