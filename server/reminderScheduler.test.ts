import { describe, expect, it, vi } from "vitest";
import { handlePortableMaintenanceReminder } from "./reminderScheduler";

function responseMock() {
  const response = { status: vi.fn(), json: vi.fn() } as any;
  response.status.mockReturnValue(response);
  response.json.mockImplementation((payload: unknown) => payload);
  return response;
}

describe("scheduled maintenance reminders", () => {
  it("rejects requests without the independent callback secret", async () => {
    const response = responseMock();
    const previous = process.env.REMINDER_CALLBACK_SECRET;
    delete process.env.REMINDER_CALLBACK_SECRET;
    await handlePortableMaintenanceReminder({ headers: {} } as any, response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "cron-only" });
    if (previous === undefined) delete process.env.REMINDER_CALLBACK_SECRET;
    else process.env.REMINDER_CALLBACK_SECRET = previous;
  });
});
