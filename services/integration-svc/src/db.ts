import pg from "pg";

const { Pool: PoolImpl } = pg;

export type Pool = pg.Pool;

export interface PoolOptions {
  connectionString: string;
  max?: number;
}

export function openPool(opts: PoolOptions): Pool {
  if (!opts.connectionString) {
    throw new Error("openPool: empty connectionString");
  }
  return new PoolImpl({
    connectionString: opts.connectionString,
    max: opts.max ?? 10,
  });
}

export function redactDsn(dsn: string): string {
  try {
    const u = new URL(dsn);
    if (u.password) u.password = "***";
    if (u.username) u.username = "***";
    return u.toString();
  } catch {
    return "<unparseable>";
  }
}
