import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./notifications", () => ({ sendTicketEmail: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key, url: `https://cdn.example/${key}` })) }));
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(async () => ({ taskUid: "task-reminder-1", nextExecutionAt: "2026-08-17T09:30:00.000Z" })), updateHeartbeatJob: vi.fn(async () => ({})), deleteHeartbeatJob: vi.fn(async () => undefined) }));

function createContext(role: "PROPERTY_MANAGER" | "TECHNICIAN" | "TENANT" | "FLAT_OWNER"): TrpcContext {
  return {
    user: { id: role === "TECHNICIAN" ? 30 : role === "TENANT" ? 20 : role === "FLAT_OWNER" ? 40 : 10, openId: "test", email: "test@example.com", name: "Test", loginMethod: "test", role, organizationId: 1, unitId: role === "TENANT" || role === "FLAT_OWNER" ? 12 : undefined, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
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
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [rows[0]]), orderBy: vi.fn(async () => rows) })) })) })),
    update: vi.fn(() => ({ set: vi.fn((value: unknown) => ({ where: vi.fn(async () => updates.push(value)) })) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    insert: vi.fn((table: unknown) => ({ values: vi.fn((value: unknown) => { inserts.push({ table, value }); const result = { returning: vi.fn(async () => [{ id: 501 }]), onConflictDoUpdate: vi.fn(async () => undefined) }; return result; }) })),
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

  it("returns role-scoped reminder lists for tenant, technician, and flat owner dashboards", async () => {
    const tenantReminder = { id: 21, organizationId: 1, unitId: 12, assignedToId: 30, title: "Tenant inspection", description: "Inspect the tenant unit", cadence: "MONTHLY", nextRunAt: new Date("2026-08-20T09:30:00.000Z") };
    const wrongTenantUnit = { ...tenantReminder, id: 24, unitId: 13, title: "Other unit inspection" };
    const otherOrganization = { ...tenantReminder, id: 25, organizationId: 2, title: "Other organization" };
    getDbMock.mockResolvedValue(createDb([tenantReminder, wrongTenantUnit, otherOrganization]));
    await expect(appRouter.createCaller(createContext("TENANT")).reminders.list()).resolves.toEqual([expect.objectContaining({ id: 21, unitId: 12 })]);
    const technicianReminder = { ...tenantReminder, id: 22, assignedToId: 30, title: "Assigned filter check" };
    const otherTechnician = { ...tenantReminder, id: 26, assignedToId: 99, title: "Other technician job" };
    getDbMock.mockResolvedValue(createDb([technicianReminder, otherTechnician]));
    await expect(appRouter.createCaller(createContext("TECHNICIAN")).reminders.list()).resolves.toEqual([expect.objectContaining({ id: 22, assignedToId: 30 })]);
    const ownerReminder = { ...tenantReminder, id: 23, title: "Owner unit inspection" };
    const otherOwnerUnit = { ...tenantReminder, id: 27, unitId: 13, title: "Other owner unit" };
    getDbMock.mockResolvedValue(createDb([ownerReminder, otherOwnerUnit]));
    await expect(appRouter.createCaller(createContext("FLAT_OWNER")).reminders.list()).resolves.toEqual([expect.objectContaining({ id: 23, unitId: 12 })]);
  });

  it("returns bilingual reminder validation and forbidden responses", async () => {
    const managerCaller = appRouter.createCaller(createContext("PROPERTY_MANAGER"));
    await expect(managerCaller.reminders.create({ title: "", description: "ok", cadence: "ONCE", dueAt: "not-a-date" })).rejects.toThrow("Reminder title is required / عنوان التذكير مطلوب");
    await expect(managerCaller.reminders.create({ title: "Valid title", description: "", cadence: "ONCE", dueAt: "not-a-date" })).rejects.toThrow("Reminder description is required / وصف التذكير مطلوب");
    await expect(managerCaller.reminders.create({ title: "Valid title", description: "Valid description", cadence: "ONCE", dueAt: "not-a-date" })).rejects.toThrow("Reminder date is invalid / تاريخ التذكير غير صالح");
    const tenantCaller = appRouter.createCaller(createContext("TENANT"));
    await expect(tenantCaller.reminders.create({ title: "Valid title", description: "Valid description", cadence: "ONCE", dueAt: "2026-08-20T09:30:00.000Z" })).rejects.toThrow("Manager role required / يلزم دور مدير العقار");
    await expect(tenantCaller.settings.update({ projectName: "Nope", projectNameArabic: "لا", logoUrl: "", primaryColor: "#8B5CF6", accentColor: "#22D3EE", emailNotificationsEnabled: false, smsNotificationsEnabled: false })).rejects.toThrow("Manager role required / يلزم دور مدير العقار");
  });

  it("localizes invalid reminder IDs across update, remove, and acknowledge", async () => {
    const managerCaller = appRouter.createCaller(createContext("PROPERTY_MANAGER"));
    await expect(managerCaller.reminders.update({ id: 0, title: "Invalid" })).rejects.toThrow("Reminder ID must be positive / معرف التذكير يجب أن يكون موجباً");
    await expect(managerCaller.reminders.remove({ id: -1 })).rejects.toThrow("Reminder ID must be positive / معرف التذكير يجب أن يكون موجباً");
    await expect(managerCaller.reminders.update({ id: 1.5, title: "Invalid" } as any)).rejects.toThrow("Reminder ID must be an integer / معرف التذكير يجب أن يكون رقماً صحيحاً");
    await expect(managerCaller.reminders.remove({ id: 2.5 } as any)).rejects.toThrow("Reminder ID must be an integer / معرف التذكير يجب أن يكون رقماً صحيحاً");
    const tenantCaller = appRouter.createCaller(createContext("TENANT"));
    await expect(tenantCaller.reminders.acknowledge({ reminderId: 0 })).rejects.toThrow("Reminder ID must be positive / معرف التذكير يجب أن يكون موجباً");
    await expect(tenantCaller.reminders.acknowledge({ reminderId: 3.5 } as any)).rejects.toThrow("Reminder ID must be an integer / معرف التذكير يجب أن يكون رقماً صحيحاً");
  });

  it("localizes reminder update, remove, and acknowledgement authorization errors", async () => {
    const managerCaller = appRouter.createCaller(createContext("PROPERTY_MANAGER"));
    getDbMock.mockResolvedValue(createDb([]));
    await expect(managerCaller.reminders.update({ id: 999, title: "Missing reminder" })).rejects.toThrow("Reminder not found in your organization / التذكير غير موجود في مؤسستك");
    getDbMock.mockResolvedValue(createDb([]));
    await expect(managerCaller.reminders.remove({ id: 999 })).rejects.toThrow("Reminder not found in your organization / التذكير غير موجود في مؤسستك");
    const tenantCaller = appRouter.createCaller(createContext("TENANT"));
    getDbMock.mockResolvedValue(createDb([{ id: 999, organizationId: 1, unitId: 13, assignedToId: 30 }]));
    await expect(tenantCaller.reminders.acknowledge({ reminderId: 999 })).rejects.toThrow("Reminder action is not authorized / ليس لديك صلاحية لهذا التذكير");
  });

  it("covers manager reminder CRUD and acknowledgement procedures", async () => {
    const dueAt = "2026-08-20T09:30:00.000Z";
    const db = createDb([{ id: 12, organizationId: 1, title: "Inspect filters", description: "Inspect all HVAC filters", cadence: "MONTHLY", dueAt: new Date(dueAt), nextRunAt: new Date(dueAt), isActive: true, scheduleCronTaskUid: "task-reminder-1", unitId: null, assignedToId: null }]);
    getDbMock.mockResolvedValue(db);
    const caller = appRouter.createCaller(createContext("PROPERTY_MANAGER"));
    await expect(caller.reminders.create({ title: "Inspect filters", description: "Inspect all HVAC filters", cadence: "MONTHLY", dueAt })).resolves.toMatchObject({ success: true });
    await expect(caller.reminders.list()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ title: "Inspect filters", isAcknowledged: false })]));
    await expect(caller.reminders.update({ id: 12, title: "Inspect HVAC filters", isActive: true })).resolves.toEqual({ success: true });
    await expect(caller.reminders.acknowledge({ reminderId: 12 })).resolves.toEqual({ success: true });
    await expect(caller.reminders.remove({ id: 12 })).resolves.toEqual({ success: true });
  });

  it("restricts developer settings to managers and persists bilingual branding controls", async () => {
    const db = createDb([{ projectName: "Maintainr", projectNameArabic: "مينتنر", primaryColor: "#8B5CF6", accentColor: "#22D3EE", emailNotificationsEnabled: false, smsNotificationsEnabled: false }]);
    getDbMock.mockResolvedValue(db);
    const managerCaller = appRouter.createCaller(createContext("PROPERTY_MANAGER"));
    await expect(managerCaller.settings.get()).resolves.toMatchObject({ projectNameArabic: "مينتنر", emailNotificationsEnabled: false });
    await expect(managerCaller.settings.update({ projectName: "Maintainr Pro", projectNameArabic: "مينتنر برو", logoUrl: "", primaryColor: "#8B5CF6", accentColor: "#22D3EE", emailNotificationsEnabled: true, smsNotificationsEnabled: false })).resolves.toEqual({ success: true });
    expect(db.inserts.at(-1)).toMatchObject({ value: expect.objectContaining({ projectNameArabic: "مينتنر برو", emailNotificationsEnabled: true }) });
    const tenantCaller = appRouter.createCaller(createContext("TENANT"));
    await expect(tenantCaller.settings.get()).rejects.toThrow();
    await expect(tenantCaller.settings.update({ projectName: "Nope", projectNameArabic: "لا", logoUrl: "", primaryColor: "#8B5CF6", accentColor: "#22D3EE", emailNotificationsEnabled: false, smsNotificationsEnabled: false })).rejects.toThrow("Manager role required / يلزم دور مدير العقار");
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
