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
