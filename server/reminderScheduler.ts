import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { developerSettings, maintenanceReminders, reminderRuns, users } from "../drizzle/schema";
import { getDb } from "./db";
import { sendTicketEmail, sendTicketSms } from "./notifications";
import { updateHeartbeatJob } from "./_core/heartbeat";
import { sdk } from "./_core/sdk";
import { isReminderOccurrenceDuplicate, nextReminderDate, shouldSendReminderChannel } from "../shared/reminderRules";

export async function handleMaintenanceReminder(req: Request, res: Response) {
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "database-unavailable" });
    const reminder = (await db.select().from(maintenanceReminders).where(eq(maintenanceReminders.scheduleCronTaskUid, cronUser.taskUid)).limit(1))[0];
    if (!reminder) return res.json({ ok: true, skipped: "orphan" });
    const taskUid = reminder.scheduleCronTaskUid;
    if (!taskUid) return res.json({ ok: true, skipped: "missing-task-uid" });
    if (!reminder.isActive) return res.json({ ok: true, skipped: "inactive" });
    const existingRun = (await db.select().from(reminderRuns).where(and(eq(reminderRuns.reminderId, reminder.id), eq(reminderRuns.occurrenceAt, reminder.nextRunAt))).limit(1))[0];
    if (existingRun && isReminderOccurrenceDuplicate(existingRun.occurrenceAt, reminder.nextRunAt)) return res.json({ ok: true, skipped: "already-processed", reminderId: reminder.id, occurrenceAt: reminder.nextRunAt });
    const runInsert = await db.insert(reminderRuns).values({ reminderId: reminder.id, occurrenceAt: reminder.nextRunAt, status: "SENT", sentAt: new Date() });
    const runId = Number(runInsert[0].insertId);
    const settings = (await db.select().from(developerSettings).where(eq(developerSettings.organizationId, reminder.organizationId)).limit(1))[0];
    const recipients = (await db.select().from(users).where(and(eq(users.organizationId, reminder.organizationId), eq(users.role, "TENANT")))).filter(user => !reminder.unitId || user.unitId === reminder.unitId);
    if (reminder.assignedToId) {
      const assigned = (await db.select().from(users).where(eq(users.id, reminder.assignedToId)).limit(1))[0];
      if (assigned && !recipients.some(user => user.id === assigned.id)) recipients.push(assigned);
    }
    const subject = `Maintenance reminder / تذكير صيانة: ${reminder.title}`;
    const text = `Maintenance reminder / تذكير صيانة\\n\\n${reminder.title}\\n${reminder.description}\\n\\nPlease review this task in Maintainr.\\nيرجى مراجعة هذه المهمة في Maintainr.`;
    const delivery = { email: 0, sms: 0 };
    for (const recipient of recipients) {
      if (shouldSendReminderChannel("email", settings)) {
        const result = await sendTicketEmail({ event: "MAINTENANCE_REMINDER", recipientEmail: recipient.email, subject, text });
        if (result.delivered) delivery.email += 1;
      }
      if (shouldSendReminderChannel("sms", settings)) {
        const result = await sendTicketSms({ recipientPhone: recipient.phone, text });
        if (result.delivered) delivery.sms += 1;
      }
    }
    const sessionToken = parseCookie(req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    await db.update(reminderRuns).set({ status: "SENT", sentAt: new Date() }).where(eq(reminderRuns.id, runId));
    if (reminder.cadence === "ONCE") {
      await db.update(maintenanceReminders).set({ isActive: false, lastRunAt: new Date() }).where(eq(maintenanceReminders.id, reminder.id));
      await updateHeartbeatJob(taskUid, { enable: false }, sessionToken);
    } else {
      await db.update(maintenanceReminders).set({ nextRunAt: nextReminderDate(reminder.cadence, reminder.nextRunAt), lastRunAt: new Date() }).where(eq(maintenanceReminders.id, reminder.id));
    }
    return res.json({ ok: true, reminderId: reminder.id, delivery });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
  }
}
