import http from "node:http";
import type { AddressInfo } from "node:net";

import { loadUpstreamConfig, type UpstreamConfig } from "./bff/bff.js";
import { aggregateHealth } from "./healthz/aggregate.js";
import { fetchQuote, MarketDataUpstreamError } from "./marketdata/proxy.js";
import { fetchProduct, createProduct, ProductsUpstreamError } from "./products/proxy.js";
import { fetchSubscription, createSubscription, SubscriptionsUpstreamError } from "./subscriptions/proxy.js";

export interface StartOptions {
  port: number;
  service: string;
  upstreamConfig?: UpstreamConfig;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const upstreamConfig = opts.upstreamConfig ?? loadUpstreamConfig(process.env);

  const server = http.createServer(async (req, res) => {
    if (req.url === "/v1/products" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const product = await createProduct(body as Parameters<typeof createProduct>[0], {
          workflowSvcUrl: upstreamConfig.workflowSvcUrl,
        });
        respondJson(res, 201, product);
      } catch (err: unknown) {
        if (err instanceof ProductsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "products_upstream", message: err.message });
        } else {
          console.error("bff: /v1/products handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url?.startsWith("/v1/products/") && req.method === "GET") {
      const id = decodeURIComponent(req.url.slice("/v1/products/".length));
      try {
        const product = await fetchProduct(id, { workflowSvcUrl: upstreamConfig.workflowSvcUrl });
        respondJson(res, 200, product);
      } catch (err: unknown) {
        if (err instanceof ProductsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "products_upstream", message: err.message });
        } else {
          console.error("bff: /v1/products/{id} handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url === "/v1/subscriptions" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const subscription = await createSubscription(body as Parameters<typeof createSubscription>[0], {
          workflowSvcUrl: upstreamConfig.workflowSvcUrl,
        });
        respondJson(res, 201, subscription);
      } catch (err: unknown) {
        if (err instanceof SubscriptionsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "subscriptions_upstream", message: err.message });
        } else {
          console.error("bff: /v1/subscriptions handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url?.startsWith("/v1/subscriptions/") && req.method === "GET") {
      const id = decodeURIComponent(req.url.slice("/v1/subscriptions/".length));
      try {
        const subscription = await fetchSubscription(id, { workflowSvcUrl: upstreamConfig.workflowSvcUrl });
        respondJson(res, 200, subscription);
      } catch (err: unknown) {
        if (err instanceof SubscriptionsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "subscriptions_upstream", message: err.message });
        } else {
          console.error("bff: /v1/subscriptions/{id} handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.method !== "GET") {
      respondJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    if (req.url === "/healthz") {
      respondJson(res, 200, { service: opts.service, status: "ok" });
      return;
    }

    if (req.url === "/healthz/composite") {
      try {
        const composite = await aggregateHealth(upstreamConfig);
        const httpStatus =
          composite.status === "ok" ? 200 : composite.status === "degraded" ? 207 : 503;
        respondJson(res, httpStatus, composite);
      } catch (err: unknown) {
        respondJson(res, 500, {
          error: "aggregate_failed",
          message: err instanceof Error ? err.message : "unknown",
        });
      }
      return;
    }

    if (req.url?.startsWith("/v1/market-data/quotes/")) {
      const symbol = decodeURIComponent(req.url.slice("/v1/market-data/quotes/".length));
      try {
        const quote = await fetchQuote(symbol, {
          marketDataSvcUrl: upstreamConfig.marketDataSvcUrl,
        });
        respondJson(res, 200, quote);
      } catch (err: unknown) {
        if (err instanceof MarketDataUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600
            ? err.httpStatus
            : 502;
          respondJson(res, status, { error: "market_data_upstream", message: err.message });
        } else {
          console.error("bff: /v1/market-data/quotes/ handler:", err);
          respondJson(res, 500, {
            error: "internal",
            message: "an internal error occurred",
          });
        }
      }
      return;
    }

    respondJson(res, 404, { error: "not_found" });
  });

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function respondJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 7103);
  startServer({ port, service: "bff" }).then(({ baseUrl }) => {
    process.stdout.write(`bff listening on ${baseUrl}\n`);
  });
}
