import { createHash, randomBytes } from "node:crypto";
import { Client } from "pg";

const DEMO_TTL_HOURS = 24;
const MAX_SESSIONS_PER_IP_WINDOW = 3;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function demoClient(connectionString = process.env.DEMO_DATABASE_URL) {
  if (!connectionString) throw new Error("DEMO_DATABASE_URL is required for demo-only operations");
  return new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });
}

export function publicDemoRegistrationEnabled() {
  return process.env.DEMO_PUBLIC_REGISTRATION_ENABLED === "true";
}

export function createDemoSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createDemoSession(ipAddress: string, connectionString = process.env.DEMO_DATABASE_URL) {
  if (!publicDemoRegistrationEnabled()) throw new Error("Public demo registration is not enabled");
  const client = demoClient(connectionString);
  const token = createDemoSessionToken();
  const tokenHash = hash(token);
  const ipHash = hash(ipAddress || "unknown");

  try {
    await client.connect();
    await client.query("begin");
    const rate = await client.query<{ count: string }>(`
      select count(*)::text as count
      from demo_sessions
      where ip_hash = $1 and created_at > now() - interval '1 hour'
    `, [ipHash]);
    if (Number(rate.rows[0]?.count ?? 0) >= MAX_SESSIONS_PER_IP_WINDOW) throw new Error("Please wait before starting another demo session");

    const session = await client.query<{ id: string; expires_at: Date }>(`
      insert into demo_sessions (token_hash, ip_hash, expires_at)
      values ($1, $2, now() + interval '24 hours')
      returning id, expires_at
    `, [tokenHash, ipHash]);
    const sessionId = session.rows[0]!.id;
    const workspace = await client.query<{ id: string }>(`
      insert into demo_workspaces (demo_session_id, expires_at)
      values ($1, now() + interval '24 hours')
      returning id
    `, [sessionId]);
    const workspaceId = workspace.rows[0]!.id;
    await client.query(`
      insert into demo_users (workspace_id, role, display_name)
      values
        ($1, 'PROPERTY_MANAGER', 'Sample Property Manager'),
        ($1, 'TENANT', 'Sample Resident'),
        ($1, 'TECHNICIAN', 'Sample Technician'),
        ($1, 'FLAT_OWNER', 'Sample Owner')
    `, [workspaceId]);
    const ticket = await client.query<{ id: string }>(`
      insert into demo_tickets (workspace_id, title, unit_label, category, priority, status)
      values ($1, 'Water pressure issue — Unit 204', 'Unit 204', 'PLUMBING', 'HIGH', 'IN_PROGRESS')
      returning id
    `, [workspaceId]);
    await client.query(`
      insert into demo_ticket_events (ticket_id, event_type, message)
      values ($1, 'REPORTED', 'Sample request reported'), ($1, 'ASSIGNED', 'Sample technician assigned'), ($1, 'IN_PROGRESS', 'Sample work in progress')
    `, [ticket.rows[0]!.id]);
    await client.query("commit");
    return { token, sessionId, expiresAt: session.rows[0]!.expires_at, workspaceId };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}
