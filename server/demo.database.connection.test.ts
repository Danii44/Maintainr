import { Client } from "pg";
import { describe, expect, it } from "vitest";

describe("demo database connection", () => {
  it("connects to the isolated demo database and finds the demo-session schema", async () => {
    const connectionString = process.env.DEMO_DATABASE_URL;
    expect(connectionString, "DEMO_DATABASE_URL must be configured for the isolated demo project").toBeTruthy();

    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    });

    try {
      await client.connect();
      const result = await client.query<{ demo_sessions_exists: boolean }>(`
        select exists (
          select 1
          from information_schema.tables
          where table_schema = 'public'
            and table_name = 'demo_sessions'
        ) as demo_sessions_exists
      `);
      expect(result.rows[0]?.demo_sessions_exists).toBe(true);
    } finally {
      await client.end().catch(() => undefined);
    }
  }, 15_000);
});
