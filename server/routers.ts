import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { ticketLogs, ticketMedia, tickets, units, users } from "../drizzle/schema";
import { sendTicketEmail } from "./notifications";
import { storagePut } from "./storage";

const category = z.enum(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "OTHER"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);
const status = z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const managerOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "PROPERTY_MANAGER") throw new Error("Manager role required");
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
    joinUnit: protectedProcedure.input(z.object({ accessCode: z.string().regex(/^\\d{6}$/, "Access code must be exactly 6 digits") })).mutation(async ({ ctx, input }) => {
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
      if (!db || !ctx.user.organizationId) throw new Error("Database or organization unavailable");
      const openId = `invited_${crypto.randomUUID()}`;
      const result = await db.insert(users).values({ openId, organizationId: ctx.user.organizationId, unitId: input.unitId, name: input.name, email: input.email, phone: input.phone, role: "TENANT", loginMethod: "invitation" });
      await sendTicketEmail({ event: "TICKET_CREATED", recipientEmail: input.email, subject: "Your Maintainr resident invitation", text: `Hello ${input.name}, your property manager has invited you to Maintainr. Use the /join-unit flow after signing in.` });
      return { success: true, userId: Number(result[0].insertId) };
    }),
    inviteTechnician: managerOnly.input(z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error("Database or organization unavailable");
      const openId = `invited_${crypto.randomUUID()}`;
      const result = await db.insert(users).values({ openId, organizationId: ctx.user.organizationId, name: input.name, email: input.email, phone: input.phone, role: "TECHNICIAN", loginMethod: "invitation" });
      await sendTicketEmail({ event: "TICKET_ASSIGNED", recipientEmail: input.email, subject: "You have been invited as a Maintainr technician", text: `Hello ${input.name}, your field technician invitation is ready. Sign in to access assigned jobs.` });
      return { success: true, userId: Number(result[0].insertId) };
    }),
    generateUnitCode: managerOnly.input(z.object({ unitId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const accessCode = String(Math.floor(100000 + Math.random() * 900000));
      await db.update(units).set({ accessCode }).where(eq(units.id, input.unitId));
      return { success: true, accessCode };
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
      if (!db || !ctx.user.organizationId) throw new Error("Database or organization unavailable");
      const result = await db.insert(tickets).values({ ...input, organizationId: ctx.user.organizationId, submittedById: ctx.user.id, status: "OPEN" });
      const ticketId = Number(result[0].insertId);
      await db.insert(ticketLogs).values({ ticketId, actorId: ctx.user.id, action: "CREATED", message: "Ticket created" });
      await sendTicketEmail({ event: "TICKET_CREATED", recipientEmail: ctx.user.email, subject: `New maintenance ticket ${ticketId}`, text: `${input.title}\n\n${input.description}` });
      return { success: true, ticketId };
    }),
    attachMedia: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), fileName: z.string().min(1).max(255), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]), base64Data: z.string().min(20) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error("Database or organization unavailable");
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
      await db.update(tickets).set({ assignedToId: input.technicianId, status: "ASSIGNED", priority: input.priority }).where(eq(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "ASSIGNED", message: `Assigned technician ${input.technicianId}` });
      await sendTicketEmail({ event: "TICKET_ASSIGNED", recipientEmail: ctx.user.email, subject: `Ticket ${input.ticketId} assigned`, text: `A technician was assigned to ticket ${input.ticketId}.` });
      return { success: true };
    }),
    updateStatus: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), status })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error("Database or organization unavailable");
      const current = await db.select().from(tickets).where(and(eq(tickets.id, input.ticketId), eq(tickets.organizationId, ctx.user.organizationId))).limit(1);
      const ticket = current[0];
      if (!ticket) throw new Error("Ticket not found in your organization");
      if (input.status === "RESOLVED") throw new Error("Use technician completion with proof and notes to resolve tickets");
      if (ctx.user.role === "TENANT" && ticket.submittedById !== ctx.user.id) throw new Error("Tenant can only update their own ticket");
      if (ctx.user.role === "TECHNICIAN" && ticket.assignedToId !== ctx.user.id) throw new Error("Technician is not assigned to this ticket");
      const allowed: Record<string, string[]> = { OPEN: ["ASSIGNED"], ASSIGNED: ["IN_PROGRESS", "OPEN"], IN_PROGRESS: ["ASSIGNED"], RESOLVED: ["CLOSED"], CLOSED: [] };
      if (!allowed[ticket.status]?.includes(input.status)) throw new Error(`Invalid transition from ${ticket.status} to ${input.status}`);
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
      if (!ticket || !ctx.user.organizationId || ticket.organizationId !== ctx.user.organizationId) throw new Error("Assigned ticket not found in your organization");
      if (ticket.status !== "IN_PROGRESS" && ticket.status !== "ASSIGNED") throw new Error("Only assigned or in-progress tickets can be resolved");
      await db.update(tickets).set({ status: "RESOLVED", resolutionNotes: input.resolutionNotes, resolvedAt: new Date() }).where(eq(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "RESOLVED", message: `Resolution completed with proof photo: ${input.proofPhotoUrl}` });
      await sendTicketEmail({ event: "TICKET_RESOLVED", recipientEmail: ctx.user.email, subject: `Ticket ${input.ticketId} resolved`, text: input.resolutionNotes });
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
