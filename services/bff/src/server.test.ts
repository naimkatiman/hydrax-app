import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { Server } from "node:http";
import { startServer } from "./server.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  ({ server, baseUrl } = await startServer({ port: 0, service: "bff" }));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("bff /healthz", () => {
  it("returns 200 with service identity", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; status: string };
    expect(body.service).toBe("bff");
    expect(body.status).toBe("ok");
  });
});

describe("bff /v1/products/{id} method guard", () => {
  it("returns 405 for non-GET methods on /v1/products/{id}", async () => {
    const { server: s, baseUrl: u } = await startServer({ port: 0, service: "bff" });
    try {
      const res = await fetch(`${u}/v1/products/abc-123`, { method: "DELETE" });
      expect(res.status).toBe(405);
    } finally {
      await new Promise<void>((resolve, reject) =>
        s.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
