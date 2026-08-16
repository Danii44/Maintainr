export type ReminderCadence = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export function nextReminderDate(cadence: ReminderCadence, from: Date) {
  const next = new Date(from);
  if (cadence === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  if (cadence === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  if (cadence === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  if (cadence === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

export type ReminderScopeRow = { organizationId: number; unitId: number | null; assignedToId: number | null };

export function filterRemindersForViewer<T extends ReminderScopeRow>(rows: T[], input: { role: "PROPERTY_MANAGER" | "TENANT" | "TECHNICIAN" | "FLAT_OWNER"; organizationId: number; unitId: number | null; userId: number }) {
  return rows.filter(row => row.organizationId === input.organizationId && (input.role === "PROPERTY_MANAGER" || (input.role === "TECHNICIAN" ? row.assignedToId === input.userId : row.unitId !== null && row.unitId === input.unitId)));
}

export function shouldSendReminderChannel(channel: "email" | "sms", settings: { emailNotificationsEnabled?: boolean; smsNotificationsEnabled?: boolean } | null | undefined) {
  return channel === "email" ? settings?.emailNotificationsEnabled === true : settings?.smsNotificationsEnabled === true;
}

export function isReminderOccurrenceDuplicate(existingOccurrence: Date | null | undefined, occurrence: Date) {
  return Boolean(existingOccurrence && existingOccurrence.getTime() === occurrence.getTime());
}

export function canAcknowledgeReminder(input: { role: "PROPERTY_MANAGER" | "TENANT" | "TECHNICIAN" | "FLAT_OWNER"; actorId: number; actorUnitId: number | null; reminderOrganizationId: number; actorOrganizationId: number | null; reminderUnitId: number | null; assignedToId: number | null }) {
  if (input.actorOrganizationId !== input.reminderOrganizationId) return false;
  if (input.role === "PROPERTY_MANAGER") return true;
  if (input.role === "TECHNICIAN") return input.assignedToId === input.actorId;
  return input.reminderUnitId !== null && input.reminderUnitId === input.actorUnitId;
}

export function cronForReminder(cadence: ReminderCadence, dueAt: Date) {
  const minute = dueAt.getUTCMinutes();
  const hour = dueAt.getUTCHours();
  if (cadence === "ONCE") return `0 ${minute} ${hour} ${dueAt.getUTCDate()} ${dueAt.getUTCMonth() + 1} *`;
  if (cadence === "DAILY") return `0 ${minute} ${hour} * * *`;
  if (cadence === "WEEKLY") return `0 ${minute} ${hour} * * ${dueAt.getUTCDay()}`;
  if (cadence === "MONTHLY") return `0 ${minute} ${hour} ${dueAt.getUTCDate()} * *`;
  return `0 ${minute} ${hour} ${dueAt.getUTCDate()} ${dueAt.getUTCMonth() + 1} *`;
}
