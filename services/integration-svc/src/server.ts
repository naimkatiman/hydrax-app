import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StartOptions {
  port: number;
  service: string;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
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
  startServer({ port, service: "integration-svc" }).then(({ baseUrl }) => {
    console.log(`integration-svc listening on ${baseUrl}`);
  });
}
