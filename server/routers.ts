import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { developerSettings, maintenanceReminders, reminderAcknowledgements, reminderRuns, ticketLogs, ticketMedia, tickets, units, users } from "../drizzle/schema";
import { sendTicketEmail } from "./notifications";
import { storagePut } from "./storage";
import { canMutateManagerTicket } from "../shared/managerActionRules";
import { completionMutationError, statusMutationError } from "../shared/ticketMutationRules";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { canAcknowledgeReminder, cronForReminder, filterRemindersForViewer } from "../shared/reminderRules";
import { reminderError } from "../shared/reminderErrors";

const category = z.enum(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "OTHER"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);
const status = z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const reminderIdSchema = z.number().int("Reminder ID must be an integer / معرف التذكير يجب أن يكون رقماً صحيحاً").positive("Reminder ID must be positive / معرف التذكير يجب أن يكون موجباً");
const managerOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "PROPERTY_MANAGER") throw new Error("Manager role required / يلزم دور مدير العقار");
  return next();
});
const technicianOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "TECHNICIAN") throw new Error("Technician role required");
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  onboarding: router({
    joinUnit: protectedProcedure.input(z.object({ accessCode: z.string().regex(/^\d{6}$/, "Access code must be exactly 6 digits") })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const match = await db.select().from(units).where(eq(units.accessCode, input.accessCode)).limit(1);
      const unit = match[0];
      if (!unit) throw new Error("Unit access code not found");
      await db.update(users).set({ unitId: unit.id }).where(eq(users.id, ctx.user.id));
      return { success: true, unitId: unit.id };
    }),
  }),
  manager: router({
    createTenant: managerOnly.input(z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), unitId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const openId = `invited_${crypto.randomUUID()}`;
      const result = await db.insert(users).values({ openId, organizationId: ctx.user.organizationId, unitId: input.unitId, name: input.name, email: input.email, phone: input.phone, role: "TENANT", loginMethod: "invitation" });
      await sendTicketEmail({ event: "TICKET_CREATED", recipientEmail: input.email, subject: "Your Maintainr resident invitation", text: `Hello ${input.name}, your property manager has invited you to Maintainr. Use the /join-unit flow after signing in.` });
      return { success: true, userId: Number(result[0].insertId) };
    }),
    inviteTechnician: managerOnly.input(z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const openId = `invited_${crypto.randomUUID()}`;
      const result = await db.insert(users).values({ openId, organizationId: ctx.user.organizationId, name: input.name, email: input.email, phone: input.phone, role: "TECHNICIAN", loginMethod: "invitation" });
      await sendTicketEmail({ event: "TICKET_ASSIGNED", recipientEmail: input.email, subject: "You have been invited as a Maintainr technician", text: `Hello ${input.name}, your field technician invitation is ready. Sign in to access assigned jobs.` });
      return { success: true, userId: Number(result[0].insertId) };
    }),
    listTechnicians: managerOnly.query(async ({ ctx }) => { const db = await getDb(); if (!db || !ctx.user.organizationId) throw new Error(reminderError("database")); return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(eq(users.organizationId, ctx.user.organizationId), eq(users.role, "TECHNICIAN"))); }),
    generateUnitCode: managerOnly.input(z.object({ unitId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const accessCode = String(Math.floor(100000 + Math.random() * 900000));
      await db.update(units).set({ accessCode }).where(eq(units.id, input.unitId));
      return { success: true, accessCode };
    }),
  }),
  reminders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) return [];
      const filters = [eq(maintenanceReminders.organizationId, ctx.user.organizationId)];
      if (ctx.user.role === "TENANT" || ctx.user.role === "FLAT_OWNER") filters.push(eq(maintenanceReminders.unitId, ctx.user.unitId ?? -1));
      if (ctx.user.role === "TECHNICIAN") filters.push(eq(maintenanceReminders.assignedToId, ctx.user.id));
      const rows = filterRemindersForViewer(await db.select().from(maintenanceReminders).where(and(...filters)).orderBy(desc(maintenanceReminders.nextRunAt)), { role: ctx.user.role as "PROPERTY_MANAGER" | "TENANT" | "TECHNICIAN" | "FLAT_OWNER", organizationId: ctx.user.organizationId, unitId: ctx.user.unitId, userId: ctx.user.id });
      const acknowledgements = await db.select().from(reminderAcknowledgements).where(eq(reminderAcknowledgements.userId, ctx.user.id)).limit(1000);
      const acknowledgedIds = new Set(acknowledgements.map(item => item.reminderId));
      return rows.map(reminder => ({ ...reminder, isAcknowledged: acknowledgedIds.has(reminder.id) }));
    }),
    acknowledge: protectedProcedure.input(z.object({ reminderId: reminderIdSchema })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const reminder = (await db.select().from(maintenanceReminders).where(and(eq(maintenanceReminders.id, input.reminderId), eq(maintenanceReminders.organizationId, ctx.user.organizationId))).limit(1))[0];
      if (!reminder) throw new Error(reminderError("notFound"));
      const allowed = canAcknowledgeReminder({ role: ctx.user.role as "PROPERTY_MANAGER" | "TENANT" | "TECHNICIAN" | "FLAT_OWNER", actorId: ctx.user.id, actorUnitId: ctx.user.unitId, reminderOrganizationId: reminder.organizationId, actorOrganizationId: ctx.user.organizationId, reminderUnitId: reminder.unitId, assignedToId: reminder.assignedToId });
      if (!allowed) throw new Error(reminderError("unauthorized"));
      await db.insert(reminderAcknowledgements).values({ reminderId: input.reminderId, userId: ctx.user.id }).onDuplicateKeyUpdate({ set: { acknowledgedAt: new Date() } });
      return { success: true };
    }),
    create: managerOnly.input(z.object({ title: z.string().min(3, "Reminder title is required / عنوان التذكير مطلوب").max(255), description: z.string().min(3, "Reminder description is required / وصف التذكير مطلوب"), propertyId: z.number().int().positive().optional(), unitId: z.number().int().positive().optional(), assignedToId: z.number().int().positive().optional(), cadence: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("ONCE"), dueAt: z.string().datetime({ message: "Reminder date is invalid / تاريخ التذكير غير صالح" }) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const dueAt = new Date(input.dueAt);
      const result = await db.insert(maintenanceReminders).values({ ...input, dueAt, nextRunAt: dueAt, organizationId: ctx.user.organizationId, createdById: ctx.user.id });
      const reminderId = Number(result[0].insertId);
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const cron = await createHeartbeatJob({ name: `reminder-${ctx.user.organizationId}-${reminderId}`, cron: cronForReminder(input.cadence, dueAt), path: "/api/scheduled/maintenanceReminder", payload: {}, description: `Maintainr reminder ${reminderId}` }, sessionToken);
      await db.update(maintenanceReminders).set({ scheduleCronTaskUid: cron.taskUid }).where(eq(maintenanceReminders.id, reminderId));
      return { success: true, reminderId, nextExecutionAt: cron.nextExecutionAt ?? null };
    }),
    update: managerOnly.input(z.object({ id: reminderIdSchema, title: z.string().min(3).max(255).optional(), description: z.string().min(3).optional(), cadence: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(), dueAt: z.string().datetime().optional(), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = (await db.select().from(maintenanceReminders).where(and(eq(maintenanceReminders.id, input.id), eq(maintenanceReminders.organizationId, ctx.user.organizationId))).limit(1))[0];
      if (!current) throw new Error(reminderError("notFound"));
      const dueAt = input.dueAt ? new Date(input.dueAt) : current.dueAt;
      const patch = { ...input, id: undefined, dueAt, nextRunAt: dueAt };
      await db.update(maintenanceReminders).set(patch).where(eq(maintenanceReminders.id, input.id));
      if (current.scheduleCronTaskUid) {
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        await updateHeartbeatJob(current.scheduleCronTaskUid, { cron: cronForReminder(input.cadence ?? current.cadence, dueAt), enable: input.isActive }, sessionToken);
      }
      return { success: true };
    }),
    remove: managerOnly.input(z.object({ id: reminderIdSchema })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = (await db.select().from(maintenanceReminders).where(and(eq(maintenanceReminders.id, input.id), eq(maintenanceReminders.organizationId, ctx.user.organizationId))).limit(1))[0];
      if (!current) throw new Error(reminderError("notFound"));
      if (current.scheduleCronTaskUid) {
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        await deleteHeartbeatJob(current.scheduleCronTaskUid, sessionToken);
      }
      await db.delete(maintenanceReminders).where(eq(maintenanceReminders.id, input.id));
      return { success: true };
    }),
  }),
  settings: router({
    get: managerOnly.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) return null;
      const current = (await db.select().from(developerSettings).where(eq(developerSettings.organizationId, ctx.user.organizationId)).limit(1))[0];
      return current ?? { projectName: "Maintainr", projectNameArabic: "Maintainr", logoUrl: null, primaryColor: "#8B5CF6", accentColor: "#22D3EE", emailNotificationsEnabled: false, smsNotificationsEnabled: false };
    }),
    update: managerOnly.input(z.object({ projectName: z.string().min(2).max(120), projectNameArabic: z.string().min(2).max(120), logoUrl: z.string().url().optional().or(z.literal("")), primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), emailNotificationsEnabled: z.boolean(), smsNotificationsEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      await db.insert(developerSettings).values({ organizationId: ctx.user.organizationId, ...input, logoUrl: input.logoUrl || null, updatedById: ctx.user.id }).onDuplicateKeyUpdate({ set: { ...input, logoUrl: input.logoUrl || null, updatedById: ctx.user.id } });
      return { success: true };
    }),
  }),
  tickets: router({
    list: protectedProcedure.input(z.object({ status: status.optional(), priority: priority.optional(), category: category.optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) return [];
      const filters = [eq(tickets.organizationId, ctx.user.organizationId)];
      if (ctx.user.role === "TENANT") filters.push(or(eq(tickets.submittedById, ctx.user.id), eq(tickets.unitId, ctx.user.unitId ?? -1))!);
      if (ctx.user.role === "TECHNICIAN") filters.push(eq(tickets.assignedToId, ctx.user.id));
      if (input?.status) filters.push(eq(tickets.status, input.status));
      if (input?.priority) filters.push(eq(tickets.priority, input.priority));
      if (input?.category) filters.push(eq(tickets.category, input.category));
      return db.select().from(tickets).where(and(...filters)).orderBy(desc(tickets.createdAt));
    }),
    create: protectedProcedure.input(z.object({ unitId: z.number().int().positive(), title: z.string().min(3), description: z.string().min(10), category, priority: priority.default("MEDIUM"), preferredAccessTime: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const result = await db.insert(tickets).values({ ...input, organizationId: ctx.user.organizationId, submittedById: ctx.user.id, status: "OPEN" });
      const ticketId = Number(result[0].insertId);
      await db.insert(ticketLogs).values({ ticketId, actorId: ctx.user.id, action: "CREATED", message: "Ticket created" });
      await sendTicketEmail({ event: "TICKET_CREATED", recipientEmail: ctx.user.email, subject: `New maintenance ticket ${ticketId}`, text: `${input.title}\n\n${input.description}` });
      return { success: true, ticketId };
    }),
    attachMedia: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), fileName: z.string().min(1).max(255), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]), base64Data: z.string().min(20) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = await db.select().from(tickets).where(and(eq(tickets.id, input.ticketId), eq(tickets.organizationId, ctx.user.organizationId))).limit(1);
      if (!current[0]) throw new Error("Ticket not found in your organization");
      const raw = input.base64Data.replace(/^data:[^;]+;base64,/, "");
      const data = Buffer.from(raw, "base64");
      const uploaded = await storagePut(`tickets/${input.ticketId}/${input.fileName}`, data, input.contentType);
      const mediaType = input.contentType.startsWith("video/") ? "VIDEO" : "IMAGE";
      await db.insert(ticketMedia).values({ ticketId: input.ticketId, uploadedById: ctx.user.id, mediaUrl: uploaded.url, mediaType });
      return { success: true, url: uploaded.url, key: uploaded.key };
    }),
    assign: managerOnly.input(z.object({ ticketId: z.number().int().positive(), technicianId: z.number().int().positive(), priority: priority.optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const current = await db.select().from(tickets).where(and(eq(tickets.id, input.ticketId), eq(tickets.organizationId, ctx.user.organizationId!))).limit(1);
      if (!current[0]) throw new Error("Ticket not found in your organization");
      if (!canMutateManagerTicket({ ticketId: input.ticketId, technicianId: input.technicianId, organizationId: ctx.user.organizationId, ticketOrganizationId: current[0].organizationId })) throw new Error("Manager action is not authorized for this organization");
      await db.update(tickets).set({ assignedToId: input.technicianId, status: "ASSIGNED", priority: input.priority }).where(eq(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "ASSIGNED", message: `Assigned technician ${input.technicianId}` });
      await sendTicketEmail({ event: "TICKET_ASSIGNED", recipientEmail: ctx.user.email, subject: `Ticket ${input.ticketId} assigned`, text: `A technician was assigned to ticket ${input.ticketId}.` });
      return { success: true };
    }),
    setPriority: managerOnly.input(z.object({ ticketId: z.number().int().positive(), priority })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db || !ctx.user.organizationId) throw new Error(reminderError("database")); const current = await db.select().from(tickets).where(and(eq(tickets.id, input.ticketId), eq(tickets.organizationId, ctx.user.organizationId))).limit(1); if (!current[0]) throw new Error("Ticket not found in your organization"); if (!canMutateManagerTicket({ ticketId: input.ticketId, organizationId: ctx.user.organizationId, ticketOrganizationId: current[0].organizationId })) throw new Error("Manager action is not authorized for this organization"); await db.update(tickets).set({ priority: input.priority }).where(eq(tickets.id, input.ticketId)); await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "PRIORITY_CHANGED", message: `Priority changed to ${input.priority}` }); return { success: true }; }),
    updateStatus: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), status })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = await db.select().from(tickets).where(and(eq(tickets.id, input.ticketId), eq(tickets.organizationId, ctx.user.organizationId))).limit(1);
      const ticket = current[0];
      if (!ticket) throw new Error("Ticket not found in your organization");
      const mutationError = statusMutationError({ actorRole: ctx.user.role as "PROPERTY_MANAGER" | "TENANT" | "TECHNICIAN", actorId: ctx.user.id, organizationId: ctx.user.organizationId, ticketOrganizationId: ticket.organizationId, submittedById: ticket.submittedById, assignedToId: ticket.assignedToId, from: ticket.status, to: input.status });
      if (mutationError) throw new Error(mutationError);
      await db.update(tickets).set({ status: input.status }).where(eq(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "STATUS_CHANGED", message: `Status changed from ${ticket.status} to ${input.status}` });
      await sendTicketEmail({ event: "STATUS_CHANGED", recipientEmail: ctx.user.email, subject: `Ticket ${input.ticketId} status updated`, text: `Status changed from ${ticket.status} to ${input.status}.` });
      return { success: true };
    }),
  }),
  technician: router({
    complete: technicianOnly.input(z.object({ ticketId: z.number().int().positive(), proofPhotoUrl: z.string().url(), resolutionNotes: z.string().min(5) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const current = await db.select().from(tickets).where(and(eq(tickets.id, input.ticketId), eq(tickets.assignedToId, ctx.user.id))).limit(1);
      const ticket = current[0];
      const completionError = completionMutationError({ organizationId: ctx.user.organizationId, ticketOrganizationId: ticket?.organizationId, assignedToId: ticket?.assignedToId, actorId: ctx.user.id, status: ticket?.status ?? "MISSING", proofPhotoUrl: input.proofPhotoUrl, resolutionNotes: input.resolutionNotes });
      if (completionError) throw new Error(completionError);
      await db.update(tickets).set({ status: "RESOLVED", resolutionNotes: input.resolutionNotes, resolvedAt: new Date() }).where(eq(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "RESOLVED", message: `Resolution completed with proof photo: ${input.proofPhotoUrl}` });
      await sendTicketEmail({ event: "TICKET_RESOLVED", recipientEmail: ctx.user.email, subject: `Ticket ${input.ticketId} resolved`, text: input.resolutionNotes });
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
