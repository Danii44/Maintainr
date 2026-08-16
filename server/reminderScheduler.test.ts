import { describe, expect, it, vi } from "vitest";

const { dbMock, authMock, sendEmailMock, sendSmsMock } = vi.hoisted(() => ({
  dbMock: vi.fn(),
  authMock: vi.fn(),
  sendEmailMock: vi.fn(),
  sendSmsMock: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: dbMock }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: authMock } }));
vi.mock("./notifications", () => ({ sendTicketEmail: sendEmailMock, sendTicketSms: sendSmsMock }));
vi.mock("./_core/heartbeat", () => ({ updateHeartbeatJob: vi.fn() }));

import { handleMaintenanceReminder } from "./reminderScheduler";

function responseMock() {
  const response = { status: vi.fn(), json: vi.fn() } as any;
  response.status.mockReturnValue(response);
  response.json.mockImplementation((payload: unknown) => payload);
  return response;
}

function selectChain(result: unknown[]) {
  return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => result) })) })) };
}

describe("scheduled maintenance reminders", () => {
  it("skips a duplicate occurrence before inserting or sending", async () => {
    const occurrence = new Date("2026-08-16T09:30:00.000Z");
    authMock.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    const db = {
      select: vi.fn()
        .mockImplementationOnce(() => selectChain([{ id: 9, scheduleCronTaskUid: "task-1", isActive: true, nextRunAt: occurrence }]))
        .mockImplementationOnce(() => selectChain([{ id: 91, reminderId: 9, occurrenceAt: occurrence, status: "SENT" }])),
      insert: vi.fn(),
    };
    dbMock.mockResolvedValue(db);
    const response = responseMock();
    await handleMaintenanceReminder({ headers: { cookie: "" } } as any, response);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ skipped: "already-processed" }));
    expect(db.insert).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendSmsMock).not.toHaveBeenCalled();
  });
});
