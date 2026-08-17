import { describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { registerWorkspace, verifyPassword } from "./auth";

function createWorkspaceDb(existingUser?: { id: number }) {
  const transactionInserts: Array<{ table: unknown; value: Record<string, unknown> }> = [];
  const sessionInserts: Array<{ table: unknown; value: Record<string, unknown> }> = [];
  const transaction = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((value: Record<string, unknown>) => {
        transactionInserts.push({ table, value });
        const row = transactionInserts.length === 1
          ? { id: 42, ...value }
          : transactionInserts.length === 2
            ? { id: 84, ...value }
            : { id: transactionInserts.length + 100, ...value };
        return { returning: vi.fn(async () => [row]) };
      }),
    })),
  };
  const db = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => existingUser ? [existingUser] : []) })) })) })),
    transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    insert: vi.fn((table: unknown) => ({ values: vi.fn(async (value: Record<string, unknown>) => { sessionInserts.push({ table, value }); }) })),
  };
  return { db, transactionInserts, sessionInserts };
}

describe("workspace registration", () => {
  it("creates an isolated organization, its Manager owner, defaults, optional property, and a session", async () => {
    const { db, transactionInserts, sessionInserts } = createWorkspaceDb();
    getDbMock.mockResolvedValue(db);

    const result = await registerWorkspace({
      name: "Northstar Owner",
      email: " OWNER@NORTHSTAR.EXAMPLE ",
      password: "password123",
      organizationName: "Northstar Realty",
      organizationNameArabic: "نورث ستار",
      portfolioCategory: "MULTI_FAMILY",
      portfolioSizeRange: "11-50",
      firstPropertyName: "Northstar Tower",
      firstPropertyAddress: "123 Market Street",
    });

    expect(result.organization).toMatchObject({ id: 42, name: "Northstar Realty", portfolioCategory: "MULTI_FAMILY", portfolioSizeRange: "11-50" });
    expect(result.user).toMatchObject({ id: 84, organizationId: 42, email: "owner@northstar.example", name: "Northstar Owner", role: "PROPERTY_MANAGER", loginMethod: "password" });
    expect(await verifyPassword("password123", result.user.passwordHash!)).toBe(true);
    expect(transactionInserts).toHaveLength(4);
    expect(transactionInserts[2].value).toMatchObject({ organizationId: 42, projectName: "Northstar Realty", projectNameArabic: "نورث ستار", updatedById: 84 });
    expect(transactionInserts[3].value).toMatchObject({ organizationId: 42, name: "Northstar Tower", address: "123 Market Street" });
    expect(sessionInserts).toHaveLength(1);
    expect(result.token).toBeTruthy();
  });

  it("rejects duplicate emails before opening the organization transaction", async () => {
    const { db } = createWorkspaceDb({ id: 5 });
    getDbMock.mockResolvedValue(db);

    await expect(registerWorkspace({ name: "Duplicate", email: "existing@example.com", password: "password123", organizationName: "Duplicate Realty" })).rejects.toThrow("An account already exists for this email");
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
