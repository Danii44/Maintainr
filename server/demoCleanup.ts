import { Client } from "pg";

export const DEMO_SESSION_CLEANUP_SQL = `
  delete from demo_sessions
  where expires_at < now() or revoked_at is not null
`;

export async function cleanupExpiredDemoSessions(connectionString = process.env.DEMO_DATABASE_URL) {
  if (!connectionString) throw new Error("DEMO_DATABASE_URL is required for demo cleanup");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    const result = await client.query(DEMO_SESSION_CLEANUP_SQL);
    return { deletedSessions: result.rowCount ?? 0 };
  } finally {
    await client.end().catch(() => undefined);
  }
}
