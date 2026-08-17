import { describe, expect, it, vi } from "vitest";
import { handlePortableMaintenanceReminder } from "./reminderScheduler";

function response() {
  const state: { status: number; body: unknown } = { status: 200, body: undefined };
  return { state, res: { status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; return this; } } as any };
}

describe("portable reminder callback", () => {
  it("rejects requests without the server-only callback secret", async () => {
    const previous = process.env.REMINDER_CALLBACK_SECRET;
    process.env.REMINDER_CALLBACK_SECRET = "expected-secret";
    const { res, state } = response();
    await handlePortableMaintenanceReminder({ headers: {}, body: {} } as any, res);
    expect(state.status).toBe(403);
    expect(state.body).toEqual({ error: "cron-only" });
    if (previous === undefined) delete process.env.REMINDER_CALLBACK_SECRET;
    else process.env.REMINDER_CALLBACK_SECRET = previous;
  });
});
