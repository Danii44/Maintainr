import type { Request, Response } from "express";
import { and, eq, lte } from "drizzle-orm";
import { developerSettings, maintenanceReminders, reminderRuns, users } from "../drizzle/schema";
import { getDb } from "./db";
import { sendTicketEmail, sendTicketSms } from "./notifications";
import { isReminderOccurrenceDuplicate, nextReminderDate, shouldSendReminderChannel } from "../shared/reminderRules";

export async function handlePortableMaintenanceReminder(req: Request, res: Response) {
  try {
    const expected = process.env.REMINDER_CALLBACK_SECRET;
    const provided = req.headers["x-maintainr-cron-secret"];
    if (!expected || provided !== expected) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "database-unavailable" });
    const requestedId = Number((req.body as { reminderId?: number } | undefined)?.reminderId || 0);
    const now = new Date();
    const reminders = await db.select().from(maintenanceReminders).where(requestedId ? eq(maintenanceReminders.id, requestedId) : and(eq(maintenanceReminders.isActive, true), lte(maintenanceReminders.nextRunAt, now)));
    const due = requestedId ? reminders : reminders.filter(reminder => reminder.nextRunAt <= now);
    const results = [];
    for (const reminder of due) {
      const existingRun = (await db.select().from(reminderRuns).where(and(eq(reminderRuns.reminderId, reminder.id), eq(reminderRuns.occurrenceAt, reminder.nextRunAt))).limit(1))[0];
      if (existingRun && isReminderOccurrenceDuplicate(existingRun.occurrenceAt, reminder.nextRunAt)) { results.push({ reminderId: reminder.id, skipped: "already-processed" }); continue; }
      const runInsert = await db.insert(reminderRuns).values({ reminderId: reminder.id, occurrenceAt: reminder.nextRunAt, status: "SENT", sentAt: now }).returning({ id: reminderRuns.id });
      const runId = runInsert[0]?.id;
      if (!runId) continue;
      const settings = (await db.select().from(developerSettings).where(eq(developerSettings.organizationId, reminder.organizationId)).limit(1))[0];
      const recipients = (await db.select().from(users).where(and(eq(users.organizationId, reminder.organizationId), eq(users.role, "TENANT")))).filter(user => !reminder.unitId || user.unitId === reminder.unitId);
      if (reminder.assignedToId) { const assigned = (await db.select().from(users).where(eq(users.id, reminder.assignedToId)).limit(1))[0]; if (assigned && !recipients.some(user => user.id === assigned.id)) recipients.push(assigned); }
      const subject = `Maintenance reminder / تذكير صيانة: ${reminder.title}`;
      const text = `Maintenance reminder / تذكير صيانة\\n\\n${reminder.title}\\n${reminder.description}\\n\\nPlease review this task in Maintainr.\\nيرجى مراجعة هذه المهمة في Maintainr.`;
      const delivery = { email: 0, sms: 0 };
      for (const recipient of recipients) { if (shouldSendReminderChannel("email", settings)) { const result = await sendTicketEmail({ event: "MAINTENANCE_REMINDER", recipientEmail: recipient.email, subject, text }); if (result.delivered) delivery.email += 1; } if (shouldSendReminderChannel("sms", settings)) { const result = await sendTicketSms({ recipientPhone: recipient.phone, text }); if (result.delivered) delivery.sms += 1; } }
      await db.update(reminderRuns).set({ status: "SENT", sentAt: now }).where(eq(reminderRuns.id, runId));
      if (reminder.cadence === "ONCE") await db.update(maintenanceReminders).set({ isActive: false, lastRunAt: now }).where(eq(maintenanceReminders.id, reminder.id));
      else await db.update(maintenanceReminders).set({ nextRunAt: nextReminderDate(reminder.cadence, reminder.nextRunAt), lastRunAt: now }).where(eq(maintenanceReminders.id, reminder.id));
      results.push({ reminderId: reminder.id, delivery });
    }
    return res.json({ ok: true, processed: results });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
  }
}
