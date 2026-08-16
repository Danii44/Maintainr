import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { ticketLogs, tickets } from "../drizzle/schema";
import { sendTicketEmail } from "./notifications";

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
  tickets: router({
    list: protectedProcedure.input(z.object({ status: status.optional(), priority: priority.optional(), category: category.optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) return [];
      const filters = [eq(tickets.organizationId, ctx.user.organizationId)];
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
    assign: managerOnly.input(z.object({ ticketId: z.number().int().positive(), technicianId: z.number().int().positive(), priority: priority.optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
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
      const allowed: Record<string, string[]> = { OPEN: ["ASSIGNED"], ASSIGNED: ["IN_PROGRESS", "OPEN"], IN_PROGRESS: ["ASSIGNED", "CLOSED"], CLOSED: [] };
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
