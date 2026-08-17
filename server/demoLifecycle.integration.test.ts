import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { cleanupExpiredDemoSessions } from "./demoCleanup";
import { createDemoSession } from "./demoSessions";

const connectionString = process.env.DEMO_DATABASE_URL!;
let createdSessionId: string | undefined;

describe("isolated demo lifecycle", () => {
  afterAll(async () => {
    if (!createdSessionId) return;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query("delete from demo_sessions where id = $1", [createdSessionId]);
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  it("creates fictional records only in the demo database and removes them after session revocation", async () => {
    expect(connectionString).toBeTruthy();
    expect(connectionString).not.toEqual(process.env.DATABASE_URL);
    const original = process.env.DEMO_PUBLIC_REGISTRATION_ENABLED;
    process.env.DEMO_PUBLIC_REGISTRATION_ENABLED = "true";

    try {
      const session = await createDemoSession(`integration-${Date.now()}`);
      createdSessionId = session.sessionId;
      const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
      try {
        await client.connect();
        const records = await client.query<{ users: string; tickets: string }>(`
          select
            (select count(*)::text from demo_users where workspace_id = $1) as users,
            (select count(*)::text from demo_tickets where workspace_id = $1) as tickets
        `, [session.workspaceId]);
        expect(records.rows[0]).toMatchObject({ users: "4", tickets: "1" });
        await client.query("update demo_sessions set revoked_at = now() where id = $1", [session.sessionId]);
      } finally {
        await client.end().catch(() => undefined);
      }

      const cleanup = await cleanupExpiredDemoSessions(connectionString);
      expect(cleanup.deletedSessions).toBeGreaterThanOrEqual(1);

      const verifier = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
      try {
        await verifier.connect();
        const deleted = await verifier.query<{ session_exists: boolean; workspace_exists: boolean }>(`
          select
            exists(select 1 from demo_sessions where id = $1) as session_exists,
            exists(select 1 from demo_workspaces where id = $2) as workspace_exists
        `, [session.sessionId, session.workspaceId]);
        expect(deleted.rows[0]).toMatchObject({ session_exists: false, workspace_exists: false });
        createdSessionId = undefined;
      } finally {
        await verifier.end().catch(() => undefined);
      }
    } finally {
      if (original === undefined) delete process.env.DEMO_PUBLIC_REGISTRATION_ENABLED;
      else process.env.DEMO_PUBLIC_REGISTRATION_ENABLED = original;
    }
  }, 20_000);
});
