import type { Express } from "express";
import { sql } from "drizzle-orm";
import { organizations } from "../drizzle/schema";
import { getDb } from "./db";

export function registerHealthRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "maintainr", database: "not-checked" });
  });

  app.get("/api/health/database", async (_req, res) => {
    const startedAt = Date.now();
    try {
      const db = await getDb();
      if (!db) {
        return res.status(503).json({ ok: false, database: "unavailable", checkedAt: new Date().toISOString() });
      }
      await db.select({ id: organizations.id }).from(organizations).limit(1);
      const requiredUserColumns = ["id", "openId", "clerkUserId", "organizationId", "unitId", "name", "email", "passwordHash", "phone", "role", "loginMethod", "createdAt", "updatedAt", "lastSignedIn"];
      const columnResult = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'`);
      const presentColumns = new Set(((columnResult as unknown as { rows?: Array<{ column_name?: unknown }> }).rows ?? []).map(row => typeof row.column_name === "string" ? row.column_name : ""));
      const missingColumns = requiredUserColumns.filter(column => !presentColumns.has(column));
      if (missingColumns.length > 0) return res.status(503).json({ ok: false, database: "connected", schema: "users_incomplete", missingColumns, checkedAt: new Date().toISOString() });
      return res.json({ ok: true, database: "connected", schema: "reachable", usersSchema: "complete", latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() });
    } catch (error) {
      console.error("[Health] Database check failed", error instanceof Error ? error.message : "unknown error");
      return res.status(503).json({ ok: false, database: "error", schema: "unverified", checkedAt: new Date().toISOString() });
    }
  });
}
