import { describe, expect, it } from "vitest";
import { canAcknowledgeReminder, cronForReminder, isReminderOccurrenceDuplicate, nextReminderDate, shouldSendReminderChannel } from "../shared/reminderRules";

describe("maintenance reminder rules", () => {
  const dueAt = new Date("2026-08-16T09:30:00.000Z");

  it("creates UTC cron expressions for each cadence", () => {
    expect(cronForReminder("DAILY", dueAt)).toBe("0 30 9 * * *");
    expect(cronForReminder("WEEKLY", dueAt)).toBe("0 30 9 * * 0");
    expect(cronForReminder("MONTHLY", dueAt)).toBe("0 30 9 16 * *");
    expect(cronForReminder("YEARLY", dueAt)).toBe("0 30 9 16 8 *");
    expect(cronForReminder("ONCE", dueAt)).toBe("0 30 9 16 8 *");
  });

  it("keeps reminder channels disabled until explicitly enabled", () => {
    expect(shouldSendReminderChannel("email", undefined)).toBe(false);
    expect(shouldSendReminderChannel("sms", { emailNotificationsEnabled: false, smsNotificationsEnabled: false })).toBe(false);
    expect(shouldSendReminderChannel("email", { emailNotificationsEnabled: true, smsNotificationsEnabled: false })).toBe(true);
    expect(shouldSendReminderChannel("sms", { emailNotificationsEnabled: true, smsNotificationsEnabled: true })).toBe(true);
  });

  it("detects the same reminder occurrence for retry deduplication", () => {
    const occurrence = new Date("2026-08-16T09:30:00.000Z");
    expect(isReminderOccurrenceDuplicate(occurrence, new Date(occurrence))).toBe(true);
    expect(isReminderOccurrenceDuplicate(null, occurrence)).toBe(false);
    expect(isReminderOccurrenceDuplicate(new Date("2026-08-17T09:30:00.000Z"), occurrence)).toBe(false);
  });

  it("enforces acknowledgement scope by organization, unit, and assignment", () => {
    const base = { actorId: 7, actorUnitId: 12, reminderOrganizationId: 4, actorOrganizationId: 4, reminderUnitId: 12, assignedToId: 7 };
    expect(canAcknowledgeReminder({ ...base, role: "PROPERTY_MANAGER" })).toBe(true);
    expect(canAcknowledgeReminder({ ...base, role: "TENANT" })).toBe(true);
    expect(canAcknowledgeReminder({ ...base, role: "FLAT_OWNER" })).toBe(true);
    expect(canAcknowledgeReminder({ ...base, role: "TECHNICIAN" })).toBe(true);
    expect(canAcknowledgeReminder({ ...base, role: "TENANT", actorUnitId: 99 })).toBe(false);
    expect(canAcknowledgeReminder({ ...base, role: "TECHNICIAN", actorId: 99 })).toBe(false);
    expect(canAcknowledgeReminder({ ...base, role: "PROPERTY_MANAGER", actorOrganizationId: 8 })).toBe(false);
  });

  it("advances recurring reminders without mutating the source date", () => {
    expect(nextReminderDate("DAILY", dueAt).toISOString()).toBe("2026-08-17T09:30:00.000Z");
    expect(nextReminderDate("WEEKLY", dueAt).toISOString()).toBe("2026-08-23T09:30:00.000Z");
    expect(nextReminderDate("MONTHLY", dueAt).toISOString()).toBe("2026-09-16T09:30:00.000Z");
    expect(dueAt.toISOString()).toBe("2026-08-16T09:30:00.000Z");
  });
});
