import type { Express } from "express";
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
      return res.json({ ok: true, database: "connected", schema: "reachable", latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() });
    } catch (error) {
      console.error("[Health] Database check failed", error instanceof Error ? error.message : "unknown error");
      return res.status(503).json({ ok: false, database: "error", schema: "unverified", checkedAt: new Date().toISOString() });
    }
  });
}
