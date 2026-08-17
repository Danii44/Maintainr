import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request } from "express";
import { parse as parseCookie } from "cookie";
import { eq, and, gt, isNull, ne } from "drizzle-orm";
import { users, sessions, passwordResetTokens, type User } from "../drizzle/schema";
import { sendTicketEmail } from "./notifications";
import { getDb } from "./db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 16;
const SESSION_BYTES = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(PASSWORD_SALT_LENGTH).toString("hex");
  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [, salt, expectedHex] = encoded.split("$");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function isRateLimited(key: string) {
  const now = Date.now();
  const state = attempts.get(key);
  if (!state || state.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  state.count += 1;
  return state.count > MAX_LOGIN_ATTEMPTS;
}

export async function createSession(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const token = randomBytes(SESSION_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  const db = await getDb();
  if (!db) return;
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function getSessionToken(req: Request) {
  const cookieToken = parseCookie(req.headers.cookie ?? "")[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const token = await getSessionToken(req);
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).limit(1);
  const user = rows[0]?.user;
  if (user) {
    await db.update(users).set({ lastSignedIn: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
  }
  return user ?? null;
}

export async function authenticate(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  if (isRateLimited(normalizedEmail)) throw new Error("Too many attempts. Try again later / محاولات كثيرة. حاول لاحقاً");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const row = (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
  if (!row?.passwordHash || !(await verifyPassword(password, row.passwordHash))) {
    throw new Error("Invalid email or password / البريد الإلكتروني أو كلمة المرور غير صحيحة");
  }
  const session = await createSession(row.id);
  return { user: row, ...session };
}

export async function updateProfile(userId: number, input: { name: string; phone?: string; avatarUrl?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const updated = (await db.update(users).set({ name: input.name.trim(), phone: input.phone?.trim() || null, avatarUrl: input.avatarUrl || null, updatedAt: new Date() }).where(eq(users.id, userId)).returning())[0];
  if (!updated) throw new Error("User profile not found / ملف المستخدم غير موجود");
  const { passwordHash: _passwordHash, ...safeUser } = updated;
  return safeUser;
}

export async function changePassword(userId: number, currentPassword: string, nextPassword: string, currentToken?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) throw new Error("Current password is incorrect / كلمة المرور الحالية غير صحيحة");
  const passwordHash = await hashPassword(nextPassword);
  await db.update(users).set({ passwordHash, loginMethod: "password", updatedAt: new Date() }).where(eq(users.id, userId));
  const sessionFilters = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (currentToken) sessionFilters.push(ne(sessions.tokenHash, hashToken(currentToken)));
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(...sessionFilters));
  return { success: true } as const;
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (isRateLimited(`reset:${normalizedEmail}`)) return { accepted: true };
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const user = (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
  if (!user?.email) return { accepted: true };
  const token = randomBytes(SESSION_BYTES).toString("base64url");
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1000 * 60 * 30) });
  const baseUrl = process.env.AUTH_BASE_URL || "http://localhost:3000";
  await sendTicketEmail({ event: "PASSWORD_RESET", recipientEmail: user.email, subject: "Reset your Maintainr password", text: `Open ${baseUrl}/reset-password?token=${token} to choose a new password. This link expires in 30 minutes.` });
  return { accepted: true };
}

export async function resetPassword(token: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const row = (await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, hashToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).limit(1))[0];
  if (!row) throw new Error("Reset link is invalid or expired / رابط إعادة التعيين غير صالح أو منتهي");
  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash, loginMethod: "password", updatedAt: new Date() }).where(eq(users.id, row.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, row.userId), isNull(sessions.revokedAt)));
  return { success: true };
}

export async function register(email: string, password: string, name: string) {
  const normalizedEmail = normalizeEmail(email);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / قاعدة البيانات غير متاحة");
  const passwordHash = await hashPassword(password);
  const bootstrapEmail = process.env.BOOTSTRAP_MANAGER_EMAIL?.trim().toLowerCase();
  const isBootstrapManager = Boolean(bootstrapEmail && normalizedEmail === bootstrapEmail);
  const existing = (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
  let user: User;
  if (existing?.passwordHash) throw new Error("An account already exists / يوجد حساب بالفعل");
  if (!existing && !isBootstrapManager) throw new Error("Public sign-up is only for the property manager setup. Apply for access instead / التسجيل العام متاح فقط لإعداد مدير العقار. استخدم طلب الوصول بدلاً من ذلك");
  if (existing) {
    const result = await db.update(users).set({ name, passwordHash, loginMethod: "password", role: isBootstrapManager ? "PROPERTY_MANAGER" : existing.role, updatedAt: new Date(), lastSignedIn: new Date() }).where(eq(users.id, existing.id)).returning();
    user = result[0];
  } else {
    const result = await db.insert(users).values({ openId: `local_${randomUUID()}`, email: normalizedEmail, name, passwordHash, loginMethod: "password", role: "PROPERTY_MANAGER" }).returning();
    user = result[0];
  }
  const session = await createSession(user.id);
  return { user, ...session };
}

export function sessionCookieOptions(req: Request) {
  const forwarded = req.headers["x-forwarded-proto"];
  const secure = req.secure || forwarded === "https" || process.env.NODE_ENV === "production";
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
}

export { COOKIE_NAME, ONE_YEAR_MS };
