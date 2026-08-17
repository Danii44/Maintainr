import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { accountInvitations, roleApplications, users, type User } from "../drizzle/schema";
import { getDb } from "./db";
import { hashPassword } from "./auth";
import { sendTicketEmail } from "./notifications";

const INVITATION_TTL_MS = 1000 * 60 * 60 * 48;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function invitationUrl(token: string) {
  const baseUrl = (process.env.AUTH_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/invitation?token=${encodeURIComponent(token)}`;
}

export async function submitRoleApplication(input: { managerEmail: string; requestedRole: "TENANT" | "TECHNICIAN"; name: string; email: string; phone?: string; message?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const managerEmail = normalizeEmail(input.managerEmail);
  const applicantEmail = normalizeEmail(input.email);
  const result = await db.insert(roleApplications).values({ managerEmail, requestedRole: input.requestedRole, name: input.name.trim(), email: applicantEmail, phone: input.phone?.trim() || null, message: input.message?.trim() || null }).returning({ id: roleApplications.id });
  const roleLabel = input.requestedRole === "TECHNICIAN" ? "Technician / فني" : "Tenant / مستأجر";
  const managerDelivery = await sendTicketEmail({ event: "ROLE_APPLICATION_SUBMITTED", recipientEmail: managerEmail, subject: `New Maintainr ${roleLabel} application / طلب وصول جديد`, text: `A new ${roleLabel} application was submitted by ${input.name.trim()} (${applicantEmail}). Review it in your Maintainr Manager dashboard.\n\nتم تقديم طلب وصول جديد من ${input.name.trim()} (${applicantEmail}). راجع الطلب من لوحة مدير Maintainr.` });
  const applicantDelivery = await sendTicketEmail({ event: "ROLE_APPLICATION_SUBMITTED", recipientEmail: applicantEmail, subject: "Maintainr application received / تم استلام طلب Maintainr", text: `Hello ${input.name.trim()}, your ${roleLabel} application was received. The Property Manager will review it. If approved, you will receive a secure invitation to create your own password.\n\nمرحباً ${input.name.trim()}، تم استلام طلبك. سيراجعه مدير العقار، وإذا تمت الموافقة ستصلك دعوة آمنة لإنشاء كلمة المرور الخاصة بك.` });
  return { success: true as const, applicationId: result[0]?.id ?? null, managerEmailDelivered: managerDelivery.delivered, applicantEmailDelivered: applicantDelivery.delivered };
}

export async function listApplications(managerEmail: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  return db.select().from(roleApplications).where(or(eq(roleApplications.managerEmail, normalizeEmail(managerEmail)), eq(roleApplications.organizationId, -1))).orderBy(roleApplications.createdAt);
}

export async function rejectApplication(applicationId: number, manager: User) {
  const db = await getDb();
  if (!db || !manager.email) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const application = (await db.select().from(roleApplications).where(and(eq(roleApplications.id, applicationId), eq(roleApplications.managerEmail, normalizeEmail(manager.email)), eq(roleApplications.status, "PENDING"))).limit(1))[0];
  if (!application) throw new Error("Application not found / الطلب غير موجود");
  await db.update(roleApplications).set({ status: "REJECTED", reviewedById: manager.id, reviewedAt: new Date(), organizationId: manager.organizationId }).where(eq(roleApplications.id, applicationId));
  return { success: true as const };
}

export async function approveApplication(applicationId: number, manager: User, unitId?: number) {
  const db = await getDb();
  if (!db || !manager.email || !manager.organizationId) throw new Error("Manager organization is required / يلزم ربط المدير بمؤسسة");
  const application = (await db.select().from(roleApplications).where(and(eq(roleApplications.id, applicationId), eq(roleApplications.managerEmail, normalizeEmail(manager.email)), eq(roleApplications.status, "PENDING"))).limit(1))[0];
  if (!application) throw new Error("Application not found / الطلب غير موجود");
  if (application.requestedRole === "TENANT" && !unitId) throw new Error("Select a unit for the tenant / اختر وحدة للمستأجر");
  const existing = (await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, application.email)).limit(1))[0];
  if (existing?.passwordHash) throw new Error("An account already exists for this email / يوجد حساب لهذا البريد بالفعل");
  const rawToken = randomBytes(32).toString("base64url");
  await db.insert(accountInvitations).values({ organizationId: manager.organizationId, requestedRole: application.requestedRole, name: application.name, email: application.email, phone: application.phone, unitId: unitId ?? null, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + INVITATION_TTL_MS), createdById: manager.id });
  await db.update(roleApplications).set({ status: "APPROVED", organizationId: manager.organizationId, requestedUnitId: unitId ?? null, reviewedById: manager.id, reviewedAt: new Date() }).where(eq(roleApplications.id, applicationId));
  const url = invitationUrl(rawToken);
  const delivery = await sendTicketEmail({ event: "ACCOUNT_INVITATION", recipientEmail: application.email, subject: "Your Maintainr account invitation / دعوة حساب Maintainr", text: `Hello ${application.name}, your Maintainr application was approved. Create your own password here: ${url}. This invitation expires in 48 hours.\n\nمرحباً ${application.name}، تمت الموافقة على طلبك. أنشئ كلمة المرور الخاصة بك من خلال الرابط الآمن أعلاه. تنتهي الدعوة خلال 48 ساعة.` });
  return { success: true as const, delivered: delivery.delivered };
}

export async function acceptInvitation(token: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const invitation = (await db.select().from(accountInvitations).where(and(eq(accountInvitations.tokenHash, hashToken(token)), isNull(accountInvitations.usedAt), gt(accountInvitations.expiresAt, new Date()))).limit(1))[0];
  if (!invitation) throw new Error("Invitation is invalid or expired / الدعوة غير صالحة أو منتهية");
  const existing = (await db.select().from(users).where(eq(users.email, invitation.email)).limit(1))[0];
  if (existing?.passwordHash) throw new Error("An account already exists for this email / يوجد حساب لهذا البريد بالفعل");
  const passwordHash = await hashPassword(password);
  let user: User;
  if (existing) {
    const result = await db.update(users).set({ organizationId: invitation.organizationId, unitId: invitation.unitId, name: invitation.name, phone: invitation.phone, passwordHash, role: invitation.requestedRole, loginMethod: "invitation", updatedAt: new Date(), lastSignedIn: new Date() }).where(eq(users.id, existing.id)).returning();
    user = result[0];
  } else {
    const result = await db.insert(users).values({ openId: `local_${randomUUID()}`, organizationId: invitation.organizationId, unitId: invitation.unitId, name: invitation.name, email: invitation.email, phone: invitation.phone, passwordHash, role: invitation.requestedRole, loginMethod: "invitation" }).returning();
    user = result[0];
  }
  await db.update(accountInvitations).set({ usedAt: new Date() }).where(eq(accountInvitations.id, invitation.id));
  return user;
}
