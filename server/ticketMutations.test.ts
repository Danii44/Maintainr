import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./notifications", () => ({ sendTicketEmail: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key, url: `https://cdn.example/${key}` })) }));

function createContext(role: "PROPERTY_MANAGER" | "TECHNICIAN" | "TENANT"): TrpcContext {
  return {
    user: { id: role === "TECHNICIAN" ? 30 : role === "TENANT" ? 20 : 10, openId: "test", email: "test@example.com", name: "Test", loginMethod: "test", role, organizationId: 1, unitId: role === "TENANT" ? undefined : undefined, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createDb(rows: unknown[]) {
  const updates: unknown[] = [];
  const inserts: unknown[] = [];
  return {
    updates,
    inserts,
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [rows[0]]) })) })) })),
    update: vi.fn(() => ({ set: vi.fn((value: unknown) => ({ where: vi.fn(async () => updates.push(value)) })) })),
    insert: vi.fn((table: unknown) => ({ values: vi.fn(async (value: unknown) => { inserts.push({ table, value }); return [{ insertId: 501 }]; }) })),
  };
}

describe("ticket mutation procedures", () => {
  it("rejects direct close from OPEN and permits RESOLVED to CLOSED", async () => {
    const db = createDb([{ id: 77, organizationId: 1, status: "OPEN", submittedById: 20, assignedToId: 30 }]);
    getDbMock.mockResolvedValueOnce(db);
    const caller = appRouter.createCaller(createContext("PROPERTY_MANAGER"));
    await expect(caller.tickets.updateStatus({ ticketId: 77, status: "CLOSED" })).rejects.toThrow("Invalid transition from OPEN to CLOSED");

    const bypassDb = createDb([{ id: 77, organizationId: 1, status: "IN_PROGRESS", submittedById: 20, assignedToId: 30 }]);
    getDbMock.mockResolvedValueOnce(bypassDb);
    await expect(caller.tickets.updateStatus({ ticketId: 77, status: "RESOLVED" })).rejects.toThrow("technician completion");

    const crossOrgDb = createDb([{ id: 77, organizationId: 2, status: "OPEN", submittedById: 20, assignedToId: 30 }]);
    getDbMock.mockResolvedValueOnce(crossOrgDb);
    await expect(caller.tickets.updateStatus({ ticketId: 77, status: "ASSIGNED" })).rejects.toThrow("Ticket not found in your organization");

    const resolvedDb = createDb([{ id: 77, organizationId: 1, status: "RESOLVED", submittedById: 20, assignedToId: 30 }]);
    getDbMock.mockResolvedValueOnce(resolvedDb);
    await expect(caller.tickets.updateStatus({ ticketId: 77, status: "CLOSED" })).resolves.toEqual({ success: true });
    expect(resolvedDb.updates).toHaveLength(1);
    expect(resolvedDb.inserts).toHaveLength(1);
  });

  it("creates a ticket and writes the creation audit log through the router", async () => {
    const db = createDb([]);
    getDbMock.mockResolvedValueOnce(db);
    const caller = appRouter.createCaller(createContext("PROPERTY_MANAGER"));
    await expect(caller.tickets.create({ unitId: 9, title: "Broken kitchen tap", description: "The kitchen tap leaks whenever it is opened.", category: "PLUMBING", priority: "MEDIUM", preferredAccessTime: "09:00-11:00" })).resolves.toEqual({ success: true, ticketId: 501 });
    expect(db.inserts).toHaveLength(2);
    expect((db.inserts[1] as { value: { action?: string } }).value.action).toBe("CREATED");
  });

  it("creates a tenant ticket and attaches multiple files through the real router procedures", async () => {
    const db = createDb([{ id: 501, organizationId: 1, status: "OPEN", submittedById: 20 }]);
    getDbMock.mockResolvedValue(db);
    const caller = appRouter.createCaller(createContext("TENANT"));
    const created = await caller.tickets.create({ unitId: 9, title: "Multiple attachment test", description: "The issue includes photos from two different angles.", category: "OTHER", priority: "MEDIUM" });
    await expect(caller.tickets.attachMedia({ ticketId: created.ticketId, fileName: "front.jpg", contentType: "image/jpeg", base64Data: "data:image/jpeg;base64,ZmFrZS1pbWFnZS1ieXRlcw==" })).resolves.toMatchObject({ success: true });
    await expect(caller.tickets.attachMedia({ ticketId: created.ticketId, fileName: "side.jpg", contentType: "image/jpeg", base64Data: "data:image/jpeg;base64,ZmFrZS1pbWFnZS1ieXRlcw==" })).resolves.toMatchObject({ success: true });
    expect(db.inserts).toHaveLength(4);
  });

  it("binds a first-time tenant to a unit through the protected join procedure", async () => {
    const db = createDb([{ id: 9, organizationId: 1, accessCode: "123456" }]);
    getDbMock.mockResolvedValueOnce(db);
    const caller = appRouter.createCaller(createContext("TENANT"));
    await expect(caller.onboarding.joinUnit({ accessCode: "123456" })).resolves.toEqual({ success: true, unitId: 9 });
    expect(db.updates).toHaveLength(1);
  });

  it("enforces technician completion proof, notes, and organization scope through the procedure", async () => {
    const db = createDb([{ id: 88, organizationId: 1, status: "IN_PROGRESS", assignedToId: 30 }]);
    getDbMock.mockResolvedValueOnce(db);
    const caller = appRouter.createCaller(createContext("TECHNICIAN"));
    await expect(caller.technician.complete({ ticketId: 88, proofPhotoUrl: "https://cdn.example/proof.jpg", resolutionNotes: "fixed" })).resolves.toEqual({ success: true });
    expect(db.updates).toHaveLength(1);
    expect(db.inserts).toHaveLength(1);

    const wrongOrgDb = createDb([{ id: 89, organizationId: 2, status: "IN_PROGRESS", assignedToId: 30 }]);
    getDbMock.mockResolvedValueOnce(wrongOrgDb);
    await expect(caller.technician.complete({ ticketId: 89, proofPhotoUrl: "https://cdn.example/proof.jpg", resolutionNotes: "fixed" })).rejects.toThrow("Assigned ticket not found in your organization");
  });
});
