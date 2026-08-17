import { describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { registerHealthRoutes } from "./health";

function createApp() {
  const routes = new Map<string, (req: unknown, res: any) => unknown>();
  return {
    routes,
    get(path: string, handler: (req: unknown, res: any) => unknown) {
      routes.set(path, handler);
    },
  };
}

function createResponse() {
  const response: any = {
    statusCode: 200,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(value: unknown) {
      response.body = value;
      return response;
    },
  };
  return response;
}

describe("database health routes", () => {
  it("reports a reachable database without returning credentials", async () => {
    getDbMock.mockResolvedValueOnce({ select: () => ({ from: () => ({ limit: async () => [] }) }), execute: async () => ({ rows: ["id", "openId", "clerkUserId", "organizationId", "unitId", "name", "email", "passwordHash", "phone", "role", "loginMethod", "createdAt", "updatedAt", "lastSignedIn"].map(column_name => ({ column_name })) }) });
    const app = createApp();
    registerHealthRoutes(app as any);
    const response = createResponse();
    await app.routes.get("/api/health/database")?.({}, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ ok: true, database: "connected", schema: "reachable" });
    expect(JSON.stringify(response.body)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("reports unavailable without exposing the connection failure", async () => {
    getDbMock.mockResolvedValueOnce(null);
    const app = createApp();
    registerHealthRoutes(app as any);
    const response = createResponse();
    await app.routes.get("/api/health/database")?.({}, response);
    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({ ok: false, database: "unavailable" });
  });
});
