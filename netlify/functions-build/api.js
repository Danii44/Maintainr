// netlify/functions/api.ts
import serverless from "serverless-http";

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/storage.ts
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/storage.ts
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
function s3Config() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return { bucket, region, accessKeyId, secretAccessKey, endpoint: process.env.S3_ENDPOINT, publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "") };
}
function s3Client(config) {
  return new S3Client({ region: config.region, endpoint: config.endpoint || void 0, forcePathStyle: Boolean(config.endpoint), credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
}
async function forgeStoragePut(key, data, contentType) {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("Storage config missing: set S3_* variables for independent hosting");
  const presignUrl = new URL("v1/storage/presign/put", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
  if (!presignResp.ok) throw new Error(`Storage presign failed (${presignResp.status})`);
  const { url } = await presignResp.json();
  const uploadResp = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: typeof data === "string" ? data : Buffer.from(data) });
  if (!uploadResp.ok) throw new Error(`Storage upload failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const config = s3Config();
  if (!config) return forgeStoragePut(key, data, contentType);
  await s3Client(config).send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: typeof data === "string" ? Buffer.from(data) : Buffer.from(data), ContentType: contentType }));
  return { key, url: config.publicBaseUrl ? `${config.publicBaseUrl}/${key}` : `/storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const key = normalizeKey(relKey);
  const config = s3Config();
  if (config) return getSignedUrl(s3Client(config), new GetObjectCommand({ Bucket: config.bucket, Key: key }), { expiresIn: 900 });
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("Storage config missing: set S3_* variables for independent hosting");
  const getUrl = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
  if (!resp.ok) throw new Error(`Storage signed URL failed (${resp.status})`);
  const { url } = await resp.json();
  return url;
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) return res.status(400).send("Missing storage key");
    try {
      res.set("Cache-Control", "private, max-age=300");
      res.redirect(307, await storageGetSignedUrl(key));
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage backend error");
    }
  });
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) return res.status(400).send("Missing storage key");
    try {
      res.set("Cache-Control", "private, max-age=300");
      res.redirect(307, await storageGetSignedUrl(key));
    } catch (err) {
      console.error("[LegacyStorageProxy] failed:", err);
      res.status(502).send("Storage backend error");
    }
  });
}

// server/routers.ts
import { and as and2, desc, eq as eq3, or } from "drizzle-orm";
import { randomUUID as randomUUID3 } from "node:crypto";
import { z as z2 } from "zod";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/auth.ts
import { createHash, randomBytes, randomUUID as randomUUID2, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { parse as parseCookie } from "cookie";
import { eq as eq2, and, gt, isNull } from "drizzle-orm";

// drizzle/schema.ts
import { boolean, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
var roleEnum = pgEnum("role", ["PROPERTY_MANAGER", "TENANT", "TECHNICIAN", "FLAT_OWNER"]);
var subscriptionTierEnum = pgEnum("subscriptionTier", ["STARTER", "GROWTH", "ENTERPRISE"]);
var categoryEnum = pgEnum("category", ["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "OTHER"]);
var priorityEnum = pgEnum("priority", ["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);
var statusEnum = pgEnum("status", ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
var mediaTypeEnum = pgEnum("mediaType", ["IMAGE", "VIDEO"]);
var reminderCadenceEnum = pgEnum("reminderCadence", ["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
var reminderRunStatusEnum = pgEnum("reminderRunStatus", ["PENDING", "SENT"]);
var organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subscriptionTier: subscriptionTierEnum("subscriptionTier").notNull().default("STARTER"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
});
var properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  totalUnits: integer("totalUnits").notNull().default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ organizationIdx: index("properties_org_idx").on(table.organizationId) }));
var units = pgTable("units", {
  id: serial("id").primaryKey(),
  propertyId: integer("propertyId").notNull(),
  unitNumber: varchar("unitNumber", { length: 32 }).notNull(),
  floorNumber: integer("floorNumber").notNull().default(1),
  accessCode: varchar("accessCode", { length: 6 }).notNull().unique(),
  ownerId: integer("ownerId"),
  currentTenantId: integer("currentTenantId")
}, (table) => ({ propertyUnitIdx: uniqueIndex("units_property_number_idx").on(table.propertyId, table.unitNumber) }));
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 128 }).notNull().unique(),
  clerkUserId: varchar("clerkUserId", { length: 128 }).unique(),
  organizationId: integer("organizationId"),
  unitId: integer("unitId"),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"),
  phone: varchar("phone", { length: 32 }),
  role: roleEnum("role").notNull().default("TENANT"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ orgRoleIdx: index("users_org_role_idx").on(table.organizationId, table.role), unitIdx: index("users_unit_idx").on(table.unitId) }));
var sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revokedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ userIdx: index("sessions_user_idx").on(table.userId), expiryIdx: index("sessions_expiry_idx").on(table.expiresAt) }));
var passwordResetTokens = pgTable("passwordResetTokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  usedAt: timestamp("usedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ userIdx: index("password_reset_user_idx").on(table.userId), expiryIdx: index("password_reset_expiry_idx").on(table.expiresAt) }));
var tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  unitId: integer("unitId").notNull(),
  submittedById: integer("submittedById").notNull(),
  assignedToId: integer("assignedToId"),
  category: categoryEnum("category").notNull(),
  priority: priorityEnum("priority").notNull().default("MEDIUM"),
  status: statusEnum("status").notNull().default("OPEN"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  preferredAccessTime: varchar("preferredAccessTime", { length: 255 }),
  resolutionNotes: text("resolutionNotes"),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ orgStatusIdx: index("tickets_org_status_idx").on(table.organizationId, table.status), assigneeIdx: index("tickets_assignee_idx").on(table.assignedToId), priorityIdx: index("tickets_priority_idx").on(table.priority) }));
var ticketMedia = pgTable("ticketMedia", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull(),
  uploadedById: integer("uploadedById").notNull(),
  mediaUrl: text("mediaUrl").notNull(),
  mediaType: mediaTypeEnum("mediaType").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ ticketIdx: index("ticket_media_ticket_idx").on(table.ticketId) }));
var maintenanceReminders = pgTable("maintenanceReminders", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  propertyId: integer("propertyId"),
  unitId: integer("unitId"),
  assignedToId: integer("assignedToId"),
  createdById: integer("createdById").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  cadence: reminderCadenceEnum("cadence").notNull().default("ONCE"),
  dueAt: timestamp("dueAt", { withTimezone: true }).notNull(),
  nextRunAt: timestamp("nextRunAt", { withTimezone: true }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ organizationIdx: index("reminders_org_idx").on(table.organizationId), nextRunIdx: index("reminders_next_run_idx").on(table.nextRunAt, table.isActive), scheduleUidIdx: uniqueIndex("reminders_schedule_uid_idx").on(table.scheduleCronTaskUid) }));
var reminderRuns = pgTable("reminderRuns", {
  id: serial("id").primaryKey(),
  reminderId: integer("reminderId").notNull(),
  occurrenceAt: timestamp("occurrenceAt", { withTimezone: true }).notNull(),
  status: reminderRunStatusEnum("status").notNull().default("PENDING"),
  sentAt: timestamp("sentAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ reminderOccurrenceIdx: uniqueIndex("reminder_runs_occurrence_idx").on(table.reminderId, table.occurrenceAt) }));
var reminderAcknowledgements = pgTable("reminderAcknowledgements", {
  id: serial("id").primaryKey(),
  reminderId: integer("reminderId").notNull(),
  userId: integer("userId").notNull(),
  acknowledgedAt: timestamp("acknowledgedAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ reminderUserIdx: uniqueIndex("reminder_ack_reminder_user_idx").on(table.reminderId, table.userId), userIdx: index("reminder_ack_user_idx").on(table.userId) }));
var developerSettings = pgTable("developerSettings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull().unique(),
  projectName: varchar("projectName", { length: 120 }).notNull().default("Maintainr"),
  projectNameArabic: varchar("projectNameArabic", { length: 120 }).notNull().default("Maintainr"),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 16 }).notNull().default("#8B5CF6"),
  accentColor: varchar("accentColor", { length: 16 }).notNull().default("#22D3EE"),
  emailNotificationsEnabled: boolean("emailNotificationsEnabled").notNull().default(false),
  smsNotificationsEnabled: boolean("smsNotificationsEnabled").notNull().default(false),
  updatedById: integer("updatedById").notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
});
var ticketLogs = pgTable("ticketLogs", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull(),
  actorId: integer("actorId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  message: text("message"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({ ticketLogIdx: index("ticket_logs_ticket_idx").on(table.ticketId, table.createdAt) }));

// server/notifications.ts
function notificationsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL);
}
async function sendTicketEmail(input) {
  if (!input.recipientEmail || !notificationsConfigured()) {
    return { delivered: false, mode: "fallback", reason: "Email credentials or recipient are not configured" };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL,
      to: [input.recipientEmail],
      subject: input.subject,
      text: input.text
    })
  });
  if (!response.ok) {
    return { delivered: false, mode: "fallback", reason: `Email provider returned ${response.status}` };
  }
  return { delivered: true, mode: "email", event: input.event };
}
function twilioEnabled() {
  return process.env.TWILIO_ENABLED === "true" && Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}
async function sendTicketSms(input) {
  if (!input.recipientPhone || !twilioEnabled()) return { delivered: false, mode: "fallback", reason: "SMS is disabled or credentials/recipient are not configured" };
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const body = new URLSearchParams({ To: input.recipientPhone, From: process.env.TWILIO_FROM, Body: input.text });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) return { delivered: false, mode: "fallback", reason: `SMS provider returned ${response.status}` };
  return { delivered: true, mode: "sms" };
}

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
var _db = null;
var _pool = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle({ client: _pool });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "PROPERTY_MANAGER";
      updateSet.role = "PROPERTY_MANAGER";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/auth.ts
var scrypt = promisify(scryptCallback);
var PASSWORD_KEY_LENGTH = 64;
var PASSWORD_SALT_LENGTH = 16;
var SESSION_BYTES = 32;
var SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 30;
var MAX_LOGIN_ATTEMPTS = 8;
var LOGIN_WINDOW_MS = 15 * 60 * 1e3;
var attempts = /* @__PURE__ */ new Map();
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
async function hashPassword(password) {
  const salt = randomBytes(PASSWORD_SALT_LENGTH).toString("hex");
  const derived = await scrypt(password, salt, PASSWORD_KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
async function verifyPassword(password, encoded) {
  const [, salt, expectedHex] = encoded.split("$");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function isRateLimited(key) {
  const now = Date.now();
  const state = attempts.get(key);
  if (!state || state.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  state.count += 1;
  return state.count > MAX_LOGIN_ATTEMPTS;
}
async function createSession(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const token = randomBytes(SESSION_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt
  });
  return { token, expiresAt };
}
async function revokeSession(token) {
  if (!token) return;
  const db = await getDb();
  if (!db) return;
  await db.update(sessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(eq2(sessions.tokenHash, hashToken(token)));
}
async function getSessionToken(req) {
  const cookieToken = parseCookie(req.headers.cookie ?? "")[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  return auth?.startsWith("Bearer ") ? auth.slice(7) : void 0;
}
async function getUserFromRequest(req) {
  const token = await getSessionToken(req);
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ user: users }).from(sessions).innerJoin(users, eq2(sessions.userId, users.id)).where(and(eq2(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
  const user = rows[0]?.user;
  if (user) {
    await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
  }
  return user ?? null;
}
async function authenticate(email, password) {
  const normalizedEmail = normalizeEmail(email);
  if (isRateLimited(normalizedEmail)) throw new Error("Too many attempts. Try again later / \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0643\u062B\u064A\u0631\u0629. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u0627\u064B");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629");
  const row = (await db.select().from(users).where(eq2(users.email, normalizedEmail)).limit(1))[0];
  if (!row?.passwordHash || !await verifyPassword(password, row.passwordHash)) {
    throw new Error("Invalid email or password / \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  }
  const session = await createSession(row.id);
  return { user: row, ...session };
}
async function requestPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email);
  if (isRateLimited(`reset:${normalizedEmail}`)) return { accepted: true };
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629");
  const user = (await db.select().from(users).where(eq2(users.email, normalizedEmail)).limit(1))[0];
  if (!user?.email) return { accepted: true };
  const token = randomBytes(SESSION_BYTES).toString("base64url");
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1e3 * 60 * 30) });
  const baseUrl = process.env.AUTH_BASE_URL || "http://localhost:3000";
  await sendTicketEmail({ event: "PASSWORD_RESET", recipientEmail: user.email, subject: "Reset your Maintainr password", text: `Open ${baseUrl}/reset-password?token=${token} to choose a new password. This link expires in 30 minutes.` });
  return { accepted: true };
}
async function resetPassword(token, password) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629");
  const row = (await db.select().from(passwordResetTokens).where(and(eq2(passwordResetTokens.tokenHash, hashToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, /* @__PURE__ */ new Date()))).limit(1))[0];
  if (!row) throw new Error("Reset link is invalid or expired / \u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0639\u064A\u064A\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A");
  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash, loginMethod: "password", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, row.userId));
  await db.update(passwordResetTokens).set({ usedAt: /* @__PURE__ */ new Date() }).where(eq2(passwordResetTokens.id, row.id));
  await db.update(sessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and(eq2(sessions.userId, row.userId), isNull(sessions.revokedAt)));
  return { success: true };
}
async function register(email, password, name) {
  const normalizedEmail = normalizeEmail(email);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable / \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629");
  const passwordHash = await hashPassword(password);
  const existing = (await db.select().from(users).where(eq2(users.email, normalizedEmail)).limit(1))[0];
  let user;
  if (existing?.passwordHash) throw new Error("An account already exists / \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628 \u0628\u0627\u0644\u0641\u0639\u0644");
  if (existing) {
    const result = await db.update(users).set({ name, passwordHash, loginMethod: "password", updatedAt: /* @__PURE__ */ new Date(), lastSignedIn: /* @__PURE__ */ new Date() }).where(eq2(users.id, existing.id)).returning();
    user = result[0];
  } else {
    const bootstrapEmail = process.env.BOOTSTRAP_MANAGER_EMAIL?.trim().toLowerCase();
    const result = await db.insert(users).values({ openId: `local_${randomUUID2()}`, email: normalizedEmail, name, passwordHash, loginMethod: "password", role: bootstrapEmail && normalizedEmail === bootstrapEmail ? "PROPERTY_MANAGER" : "TENANT" }).returning();
    user = result[0];
  }
  const session = await createSession(user.id);
  return { user, ...session };
}
function sessionCookieOptions(req) {
  const forwarded = req.headers["x-forwarded-proto"];
  const secure = req.secure || forwarded === "https" || process.env.NODE_ENV === "production";
  return { httpOnly: true, sameSite: "lax", secure, path: "/" };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// shared/managerActionRules.ts
function canMutateManagerTicket(input) {
  if (!Number.isInteger(input.ticketId) || input.ticketId <= 0) return false;
  if (input.technicianId !== void 0 && (!Number.isInteger(input.technicianId) || input.technicianId <= 0)) return false;
  return Boolean(input.organizationId && input.ticketOrganizationId && input.organizationId === input.ticketOrganizationId);
}

// shared/maintenanceRules.ts
function canMarkResolved(input) {
  return Boolean(input.proofPhotoUrl?.trim()) && Boolean(input.resolutionNotes?.trim());
}
var allowedTransitions = {
  OPEN: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS", "OPEN"],
  IN_PROGRESS: ["ASSIGNED"],
  RESOLVED: ["CLOSED"],
  CLOSED: []
};
function canTransitionStatus(from, to) {
  return allowedTransitions[from]?.includes(to) ?? false;
}

// shared/ticketMutationRules.ts
function statusMutationError(input) {
  if (!input.organizationId || input.ticketOrganizationId !== input.organizationId) return "Ticket not found in your organization";
  if (input.to === "RESOLVED") return "Use technician completion with proof and notes to resolve tickets";
  if (input.actorRole === "TENANT" && input.submittedById !== input.actorId) return "Tenant can only update their own ticket";
  if (input.actorRole === "TECHNICIAN" && input.assignedToId !== input.actorId) return "Technician is not assigned to this ticket";
  if (!canTransitionStatus(input.from, input.to)) return `Invalid transition from ${input.from} to ${input.to}`;
  return null;
}
function completionMutationError(input) {
  if (!input.organizationId || input.ticketOrganizationId !== input.organizationId || input.assignedToId !== input.actorId) return "Assigned ticket not found in your organization";
  if (input.status !== "IN_PROGRESS" && input.status !== "ASSIGNED") return "Only assigned or in-progress tickets can be resolved";
  if (!canMarkResolved({ proofPhotoUrl: input.proofPhotoUrl, resolutionNotes: input.resolutionNotes })) return "Proof photo and resolution notes are required";
  return null;
}

// shared/reminderRules.ts
function nextReminderDate(cadence, from) {
  const next = new Date(from);
  if (cadence === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  if (cadence === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  if (cadence === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  if (cadence === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}
function filterRemindersForViewer(rows, input) {
  return rows.filter((row) => row.organizationId === input.organizationId && (input.role === "PROPERTY_MANAGER" || (input.role === "TECHNICIAN" ? row.assignedToId === input.userId : row.unitId !== null && row.unitId === input.unitId)));
}
function shouldSendReminderChannel(channel, settings) {
  return channel === "email" ? settings?.emailNotificationsEnabled === true : settings?.smsNotificationsEnabled === true;
}
function isReminderOccurrenceDuplicate(existingOccurrence, occurrence) {
  return Boolean(existingOccurrence && existingOccurrence.getTime() === occurrence.getTime());
}
function canAcknowledgeReminder(input) {
  if (input.actorOrganizationId !== input.reminderOrganizationId) return false;
  if (input.role === "PROPERTY_MANAGER") return true;
  if (input.role === "TECHNICIAN") return input.assignedToId === input.actorId;
  return input.reminderUnitId !== null && input.reminderUnitId === input.actorUnitId;
}

// shared/reminderErrors.ts
function reminderError(key) {
  const messages = {
    database: "Database unavailable / \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629",
    notFound: "Reminder not found in your organization / \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0645\u0624\u0633\u0633\u062A\u0643",
    unauthorized: "Reminder action is not authorized / \u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u062A\u0630\u0643\u064A\u0631",
    invalidDueAt: "Reminder date is invalid / \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D",
    invalidTitle: "Reminder title and description are required / \u0639\u0646\u0648\u0627\u0646 \u0648\u0648\u0635\u0641 \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646"
  };
  return messages[key];
}

// server/routers.ts
var category = z2.enum(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "OTHER"]);
var priority = z2.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);
var status = z2.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
var reminderIdSchema = z2.number().int("Reminder ID must be an integer / \u0645\u0639\u0631\u0641 \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B").positive("Reminder ID must be positive / \u0645\u0639\u0631\u0641 \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0648\u062C\u0628\u0627\u064B");
var managerOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "PROPERTY_MANAGER") throw new Error("Manager role required / \u064A\u0644\u0632\u0645 \u062F\u0648\u0631 \u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631");
  return next();
});
var technicianOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "TECHNICIAN") throw new Error("Technician role required");
  return next();
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    signIn: publicProcedure.input(z2.object({ email: z2.string().email(), password: z2.string().min(8) })).mutation(async ({ ctx, input }) => {
      const result = await authenticate(input.email, input.password);
      ctx.res.cookie(COOKIE_NAME, result.token, { ...sessionCookieOptions(ctx.req), maxAge: Math.floor(ONE_YEAR_MS / 1e3) });
      return result.user;
    }),
    signUp: publicProcedure.input(z2.object({ name: z2.string().min(2), email: z2.string().email(), password: z2.string().min(8) })).mutation(async ({ ctx, input }) => {
      const result = await register(input.email, input.password, input.name);
      ctx.res.cookie(COOKIE_NAME, result.token, { ...sessionCookieOptions(ctx.req), maxAge: Math.floor(ONE_YEAR_MS / 1e3) });
      return result.user;
    }),
    requestPasswordReset: publicProcedure.input(z2.object({ email: z2.string().email() })).mutation(({ input }) => requestPasswordReset(input.email)),
    resetPassword: publicProcedure.input(z2.object({ token: z2.string().min(20), password: z2.string().min(8) })).mutation(({ input }) => resetPassword(input.token, input.password)),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeSession(await getSessionToken(ctx.req));
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  onboarding: router({
    joinUnit: protectedProcedure.input(z2.object({ accessCode: z2.string().regex(/^\d{6}$/, "Access code must be exactly 6 digits") })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const match = await db.select().from(units).where(eq3(units.accessCode, input.accessCode)).limit(1);
      const unit = match[0];
      if (!unit) throw new Error("Unit access code not found");
      await db.update(users).set({ unitId: unit.id }).where(eq3(users.id, ctx.user.id));
      return { success: true, unitId: unit.id };
    })
  }),
  manager: router({
    createTenant: managerOnly.input(z2.object({ name: z2.string().min(2), email: z2.string().email(), phone: z2.string().optional(), unitId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const openId = `invited_${crypto.randomUUID()}`;
      const result = await db.insert(users).values({ openId, organizationId: ctx.user.organizationId, unitId: input.unitId, name: input.name, email: input.email, phone: input.phone, role: "TENANT", loginMethod: "invitation" }).returning({ id: users.id });
      await sendTicketEmail({ event: "TICKET_CREATED", recipientEmail: input.email, subject: "Your Maintainr resident invitation", text: `Hello ${input.name}, your property manager has invited you to Maintainr. Use the /join-unit flow after signing in.` });
      return { success: true, userId: result[0]?.id ?? null };
    }),
    inviteTechnician: managerOnly.input(z2.object({ name: z2.string().min(2), email: z2.string().email(), phone: z2.string().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const openId = `invited_${crypto.randomUUID()}`;
      const result = await db.insert(users).values({ openId, organizationId: ctx.user.organizationId, name: input.name, email: input.email, phone: input.phone, role: "TECHNICIAN", loginMethod: "invitation" }).returning({ id: users.id });
      await sendTicketEmail({ event: "TICKET_ASSIGNED", recipientEmail: input.email, subject: "You have been invited as a Maintainr technician", text: `Hello ${input.name}, your field technician invitation is ready. Sign in to access assigned jobs.` });
      return { success: true, userId: result[0]?.id ?? null };
    }),
    listTechnicians: managerOnly.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and2(eq3(users.organizationId, ctx.user.organizationId), eq3(users.role, "TECHNICIAN")));
    }),
    generateUnitCode: managerOnly.input(z2.object({ unitId: z2.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const accessCode = String(Math.floor(1e5 + Math.random() * 9e5));
      await db.update(units).set({ accessCode }).where(eq3(units.id, input.unitId));
      return { success: true, accessCode };
    })
  }),
  reminders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) return [];
      const filters = [eq3(maintenanceReminders.organizationId, ctx.user.organizationId)];
      if (ctx.user.role === "TENANT" || ctx.user.role === "FLAT_OWNER") filters.push(eq3(maintenanceReminders.unitId, ctx.user.unitId ?? -1));
      if (ctx.user.role === "TECHNICIAN") filters.push(eq3(maintenanceReminders.assignedToId, ctx.user.id));
      const rows = filterRemindersForViewer(await db.select().from(maintenanceReminders).where(and2(...filters)).orderBy(desc(maintenanceReminders.nextRunAt)), { role: ctx.user.role, organizationId: ctx.user.organizationId, unitId: ctx.user.unitId, userId: ctx.user.id });
      const acknowledgements = await db.select().from(reminderAcknowledgements).where(eq3(reminderAcknowledgements.userId, ctx.user.id)).limit(1e3);
      const acknowledgedIds = new Set(acknowledgements.map((item) => item.reminderId));
      return rows.map((reminder) => ({ ...reminder, isAcknowledged: acknowledgedIds.has(reminder.id) }));
    }),
    acknowledge: protectedProcedure.input(z2.object({ reminderId: reminderIdSchema })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const reminder = (await db.select().from(maintenanceReminders).where(and2(eq3(maintenanceReminders.id, input.reminderId), eq3(maintenanceReminders.organizationId, ctx.user.organizationId))).limit(1))[0];
      if (!reminder) throw new Error(reminderError("notFound"));
      const allowed = canAcknowledgeReminder({ role: ctx.user.role, actorId: ctx.user.id, actorUnitId: ctx.user.unitId, reminderOrganizationId: reminder.organizationId, actorOrganizationId: ctx.user.organizationId, reminderUnitId: reminder.unitId, assignedToId: reminder.assignedToId });
      if (!allowed) throw new Error(reminderError("unauthorized"));
      await db.insert(reminderAcknowledgements).values({ reminderId: input.reminderId, userId: ctx.user.id }).onConflictDoUpdate({ target: [reminderAcknowledgements.reminderId, reminderAcknowledgements.userId], set: { acknowledgedAt: /* @__PURE__ */ new Date() } });
      return { success: true };
    }),
    create: managerOnly.input(z2.object({ title: z2.string().min(3, "Reminder title is required / \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u0645\u0637\u0644\u0648\u0628").max(255), description: z2.string().min(3, "Reminder description is required / \u0648\u0635\u0641 \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u0645\u0637\u0644\u0648\u0628"), propertyId: z2.number().int().positive().optional(), unitId: z2.number().int().positive().optional(), assignedToId: z2.number().int().positive().optional(), cadence: z2.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("ONCE"), dueAt: z2.string().datetime({ message: "Reminder date is invalid / \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0630\u0643\u064A\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" }) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const dueAt = new Date(input.dueAt);
      const result = await db.insert(maintenanceReminders).values({ ...input, dueAt, nextRunAt: dueAt, organizationId: ctx.user.organizationId, createdById: ctx.user.id }).returning({ id: maintenanceReminders.id });
      const reminderId = result[0]?.id;
      if (!reminderId) throw new Error(reminderError("database"));
      const schedulerUid = `portable-${randomUUID3()}`;
      await db.update(maintenanceReminders).set({ scheduleCronTaskUid: schedulerUid }).where(eq3(maintenanceReminders.id, reminderId));
      return { success: true, reminderId, nextExecutionAt: dueAt.toISOString(), scheduler: "portable" };
    }),
    update: managerOnly.input(z2.object({ id: reminderIdSchema, title: z2.string().min(3).max(255).optional(), description: z2.string().min(3).optional(), cadence: z2.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(), dueAt: z2.string().datetime().optional(), isActive: z2.boolean().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = (await db.select().from(maintenanceReminders).where(and2(eq3(maintenanceReminders.id, input.id), eq3(maintenanceReminders.organizationId, ctx.user.organizationId))).limit(1))[0];
      if (!current) throw new Error(reminderError("notFound"));
      const dueAt = input.dueAt ? new Date(input.dueAt) : current.dueAt;
      const patch = { ...input, id: void 0, dueAt, nextRunAt: dueAt };
      await db.update(maintenanceReminders).set(patch).where(eq3(maintenanceReminders.id, input.id));
      return { success: true };
    }),
    remove: managerOnly.input(z2.object({ id: reminderIdSchema })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = (await db.select().from(maintenanceReminders).where(and2(eq3(maintenanceReminders.id, input.id), eq3(maintenanceReminders.organizationId, ctx.user.organizationId))).limit(1))[0];
      if (!current) throw new Error(reminderError("notFound"));
      await db.delete(maintenanceReminders).where(eq3(maintenanceReminders.id, input.id));
      return { success: true };
    })
  }),
  settings: router({
    get: managerOnly.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) return null;
      const current = (await db.select().from(developerSettings).where(eq3(developerSettings.organizationId, ctx.user.organizationId)).limit(1))[0];
      return current ?? { projectName: "Maintainr", projectNameArabic: "Maintainr", logoUrl: null, primaryColor: "#8B5CF6", accentColor: "#22D3EE", emailNotificationsEnabled: false, smsNotificationsEnabled: false };
    }),
    update: managerOnly.input(z2.object({ projectName: z2.string().min(2).max(120), projectNameArabic: z2.string().min(2).max(120), logoUrl: z2.string().url().optional().or(z2.literal("")), primaryColor: z2.string().regex(/^#[0-9A-Fa-f]{6}$/), accentColor: z2.string().regex(/^#[0-9A-Fa-f]{6}$/), emailNotificationsEnabled: z2.boolean(), smsNotificationsEnabled: z2.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      await db.insert(developerSettings).values({ organizationId: ctx.user.organizationId, ...input, logoUrl: input.logoUrl || null, updatedById: ctx.user.id }).onConflictDoUpdate({ target: developerSettings.organizationId, set: { ...input, logoUrl: input.logoUrl || null, updatedById: ctx.user.id } });
      return { success: true };
    })
  }),
  tickets: router({
    list: protectedProcedure.input(z2.object({ status: status.optional(), priority: priority.optional(), category: category.optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) return [];
      const filters = [eq3(tickets.organizationId, ctx.user.organizationId)];
      if (ctx.user.role === "TENANT") filters.push(or(eq3(tickets.submittedById, ctx.user.id), eq3(tickets.unitId, ctx.user.unitId ?? -1)));
      if (ctx.user.role === "TECHNICIAN") filters.push(eq3(tickets.assignedToId, ctx.user.id));
      if (input?.status) filters.push(eq3(tickets.status, input.status));
      if (input?.priority) filters.push(eq3(tickets.priority, input.priority));
      if (input?.category) filters.push(eq3(tickets.category, input.category));
      return db.select().from(tickets).where(and2(...filters)).orderBy(desc(tickets.createdAt));
    }),
    create: protectedProcedure.input(z2.object({ unitId: z2.number().int().positive(), title: z2.string().min(3), description: z2.string().min(10), category, priority: priority.default("MEDIUM"), preferredAccessTime: z2.string().optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const result = await db.insert(tickets).values({ ...input, organizationId: ctx.user.organizationId, submittedById: ctx.user.id, status: "OPEN" }).returning({ id: tickets.id });
      const ticketId = result[0]?.id;
      if (!ticketId) throw new Error(reminderError("database"));
      await db.insert(ticketLogs).values({ ticketId, actorId: ctx.user.id, action: "CREATED", message: "Ticket created" });
      await sendTicketEmail({ event: "TICKET_CREATED", recipientEmail: ctx.user.email, subject: `New maintenance ticket ${ticketId}`, text: `${input.title}

${input.description}` });
      return { success: true, ticketId };
    }),
    attachMedia: protectedProcedure.input(z2.object({ ticketId: z2.number().int().positive(), fileName: z2.string().min(1).max(255), contentType: z2.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]), base64Data: z2.string().min(20) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = await db.select().from(tickets).where(and2(eq3(tickets.id, input.ticketId), eq3(tickets.organizationId, ctx.user.organizationId))).limit(1);
      if (!current[0]) throw new Error("Ticket not found in your organization");
      const raw = input.base64Data.replace(/^data:[^;]+;base64,/, "");
      const data = Buffer.from(raw, "base64");
      const uploaded = await storagePut(`tickets/${input.ticketId}/${input.fileName}`, data, input.contentType);
      const mediaType = input.contentType.startsWith("video/") ? "VIDEO" : "IMAGE";
      await db.insert(ticketMedia).values({ ticketId: input.ticketId, uploadedById: ctx.user.id, mediaUrl: uploaded.url, mediaType });
      return { success: true, url: uploaded.url, key: uploaded.key };
    }),
    assign: managerOnly.input(z2.object({ ticketId: z2.number().int().positive(), technicianId: z2.number().int().positive(), priority: priority.optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const current = await db.select().from(tickets).where(and2(eq3(tickets.id, input.ticketId), eq3(tickets.organizationId, ctx.user.organizationId))).limit(1);
      if (!current[0]) throw new Error("Ticket not found in your organization");
      if (!canMutateManagerTicket({ ticketId: input.ticketId, technicianId: input.technicianId, organizationId: ctx.user.organizationId, ticketOrganizationId: current[0].organizationId })) throw new Error("Manager action is not authorized for this organization");
      await db.update(tickets).set({ assignedToId: input.technicianId, status: "ASSIGNED", priority: input.priority }).where(eq3(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "ASSIGNED", message: `Assigned technician ${input.technicianId}` });
      await sendTicketEmail({ event: "TICKET_ASSIGNED", recipientEmail: ctx.user.email, subject: `Ticket ${input.ticketId} assigned`, text: `A technician was assigned to ticket ${input.ticketId}.` });
      return { success: true };
    }),
    setPriority: managerOnly.input(z2.object({ ticketId: z2.number().int().positive(), priority })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = await db.select().from(tickets).where(and2(eq3(tickets.id, input.ticketId), eq3(tickets.organizationId, ctx.user.organizationId))).limit(1);
      if (!current[0]) throw new Error("Ticket not found in your organization");
      if (!canMutateManagerTicket({ ticketId: input.ticketId, organizationId: ctx.user.organizationId, ticketOrganizationId: current[0].organizationId })) throw new Error("Manager action is not authorized for this organization");
      await db.update(tickets).set({ priority: input.priority }).where(eq3(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "PRIORITY_CHANGED", message: `Priority changed to ${input.priority}` });
      return { success: true };
    }),
    updateStatus: protectedProcedure.input(z2.object({ ticketId: z2.number().int().positive(), status })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user.organizationId) throw new Error(reminderError("database"));
      const current = await db.select().from(tickets).where(and2(eq3(tickets.id, input.ticketId), eq3(tickets.organizationId, ctx.user.organizationId))).limit(1);
      const ticket = current[0];
      if (!ticket) throw new Error("Ticket not found in your organization");
      const mutationError = statusMutationError({ actorRole: ctx.user.role, actorId: ctx.user.id, organizationId: ctx.user.organizationId, ticketOrganizationId: ticket.organizationId, submittedById: ticket.submittedById, assignedToId: ticket.assignedToId, from: ticket.status, to: input.status });
      if (mutationError) throw new Error(mutationError);
      await db.update(tickets).set({ status: input.status }).where(eq3(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "STATUS_CHANGED", message: `Status changed from ${ticket.status} to ${input.status}` });
      await sendTicketEmail({ event: "STATUS_CHANGED", recipientEmail: ctx.user.email, subject: `Ticket ${input.ticketId} status updated`, text: `Status changed from ${ticket.status} to ${input.status}.` });
      return { success: true };
    })
  }),
  technician: router({
    complete: technicianOnly.input(z2.object({ ticketId: z2.number().int().positive(), proofPhotoUrl: z2.string().url(), resolutionNotes: z2.string().min(5) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const current = await db.select().from(tickets).where(and2(eq3(tickets.id, input.ticketId), eq3(tickets.assignedToId, ctx.user.id))).limit(1);
      const ticket = current[0];
      const completionError = completionMutationError({ organizationId: ctx.user.organizationId, ticketOrganizationId: ticket?.organizationId, assignedToId: ticket?.assignedToId, actorId: ctx.user.id, status: ticket?.status ?? "MISSING", proofPhotoUrl: input.proofPhotoUrl, resolutionNotes: input.resolutionNotes });
      if (completionError) throw new Error(completionError);
      await db.update(tickets).set({ status: "RESOLVED", resolutionNotes: input.resolutionNotes, resolvedAt: /* @__PURE__ */ new Date() }).where(eq3(tickets.id, input.ticketId));
      await db.insert(ticketLogs).values({ ticketId: input.ticketId, actorId: ctx.user.id, action: "RESOLVED", message: `Resolution completed with proof photo: ${input.proofPhotoUrl}` });
      await sendTicketEmail({ event: "TICKET_RESOLVED", recipientEmail: ctx.user.email, subject: `Ticket ${input.ticketId} resolved`, text: input.resolutionNotes });
      return { success: true };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await getUserFromRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/reminderScheduler.ts
import { and as and3, eq as eq4, lte } from "drizzle-orm";
import { parse as parseCookie2 } from "cookie";

// server/_core/heartbeat.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var SERVICE = "webdevtoken.v1.WebDevService";
var buildEndpoint = (rpc) => {
  if (!ENV.forgeApiUrl) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service URL is not configured (BUILT_IN_FORGE_API_URL)."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service API key is not configured (BUILT_IN_FORGE_API_KEY)."
    });
  }
  const baseUrl = ENV.forgeApiUrl;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${SERVICE}/${rpc}`, normalizedBase).toString();
};
var callForge = async (rpc, body, userSession) => {
  const endpoint = buildEndpoint(rpc);
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${ENV.forgeApiKey}`,
    "content-type": "application/json",
    "connect-protocol-version": "1"
  };
  if (userSession) {
    headers["x-manus-user-session"] = userSession;
  }
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: `Heartbeat ${rpc} network error: ${String(error)}`
    });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw mapForgeError(response, detail, rpc);
  }
  return await response.json();
};
var mapForgeError = (response, detail, rpc) => {
  const status2 = response.status;
  let code = "INTERNAL_SERVER_ERROR";
  if (status2 === 401) code = "UNAUTHORIZED";
  else if (status2 === 403) code = "FORBIDDEN";
  else if (status2 === 404) code = "NOT_FOUND";
  else if (status2 === 400 || status2 === 422) code = "BAD_REQUEST";
  else if (status2 === 409) code = "CONFLICT";
  else if (status2 === 429) code = "TOO_MANY_REQUESTS";
  return new TRPCError3({
    code,
    message: `Heartbeat ${rpc} failed (${status2})${detail ? `: ${detail}` : ""}`
  });
};
var stringifyPayload = (payload) => {
  if (payload === void 0 || payload === null) return "{}";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload);
};
var validateCallbackPath = (path3) => {
  if (!path3 || !path3.startsWith("/api/scheduled/")) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: "callback path must start with /api/scheduled/"
    });
  }
};
async function updateHeartbeatJob(taskUid, patch, userSession) {
  if (patch.path !== void 0) validateCallbackPath(patch.path);
  const body = { taskUid };
  if (patch.cron !== void 0) body.cronExpression = patch.cron;
  if (patch.path !== void 0) body.callbackPath = patch.path;
  if (patch.method !== void 0) body.callbackMethod = patch.method;
  if (patch.payload !== void 0) {
    body.callbackPayload = stringifyPayload(patch.payload);
  }
  if (patch.description !== void 0) body.description = patch.description;
  if (patch.enable !== void 0) body.enable = patch.enable;
  return callForge(
    "UpdateHeartbeatJob",
    body,
    userSession
  );
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    clerkUserId: null,
    organizationId: null,
    unitId: null,
    phone: null,
    role: "PROPERTY_MANAGER",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/reminderScheduler.ts
async function handlePortableMaintenanceReminder(req, res) {
  try {
    const expected = process.env.REMINDER_CALLBACK_SECRET;
    const provided = req.headers["x-maintainr-cron-secret"];
    if (!expected || provided !== expected) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "database-unavailable" });
    const requestedId = Number(req.body?.reminderId || 0);
    const now = /* @__PURE__ */ new Date();
    const reminders = await db.select().from(maintenanceReminders).where(requestedId ? eq4(maintenanceReminders.id, requestedId) : and3(eq4(maintenanceReminders.isActive, true), lte(maintenanceReminders.nextRunAt, now)));
    const due = requestedId ? reminders : reminders.filter((reminder) => reminder.nextRunAt <= now);
    const results = [];
    for (const reminder of due) {
      const existingRun = (await db.select().from(reminderRuns).where(and3(eq4(reminderRuns.reminderId, reminder.id), eq4(reminderRuns.occurrenceAt, reminder.nextRunAt))).limit(1))[0];
      if (existingRun && isReminderOccurrenceDuplicate(existingRun.occurrenceAt, reminder.nextRunAt)) {
        results.push({ reminderId: reminder.id, skipped: "already-processed" });
        continue;
      }
      const runInsert = await db.insert(reminderRuns).values({ reminderId: reminder.id, occurrenceAt: reminder.nextRunAt, status: "SENT", sentAt: now }).returning({ id: reminderRuns.id });
      const runId = runInsert[0]?.id;
      if (!runId) continue;
      const settings = (await db.select().from(developerSettings).where(eq4(developerSettings.organizationId, reminder.organizationId)).limit(1))[0];
      const recipients = (await db.select().from(users).where(and3(eq4(users.organizationId, reminder.organizationId), eq4(users.role, "TENANT")))).filter((user) => !reminder.unitId || user.unitId === reminder.unitId);
      if (reminder.assignedToId) {
        const assigned = (await db.select().from(users).where(eq4(users.id, reminder.assignedToId)).limit(1))[0];
        if (assigned && !recipients.some((user) => user.id === assigned.id)) recipients.push(assigned);
      }
      const subject = `Maintenance reminder / \u062A\u0630\u0643\u064A\u0631 \u0635\u064A\u0627\u0646\u0629: ${reminder.title}`;
      const text2 = `Maintenance reminder / \u062A\u0630\u0643\u064A\u0631 \u0635\u064A\u0627\u0646\u0629\\n\\n${reminder.title}\\n${reminder.description}\\n\\nPlease review this task in Maintainr.\\n\u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0647\u0630\u0647 \u0627\u0644\u0645\u0647\u0645\u0629 \u0641\u064A Maintainr.`;
      const delivery = { email: 0, sms: 0 };
      for (const recipient of recipients) {
        if (shouldSendReminderChannel("email", settings)) {
          const result = await sendTicketEmail({ event: "MAINTENANCE_REMINDER", recipientEmail: recipient.email, subject, text: text2 });
          if (result.delivered) delivery.email += 1;
        }
        if (shouldSendReminderChannel("sms", settings)) {
          const result = await sendTicketSms({ recipientPhone: recipient.phone, text: text2 });
          if (result.delivered) delivery.sms += 1;
        }
      }
      await db.update(reminderRuns).set({ status: "SENT", sentAt: now }).where(eq4(reminderRuns.id, runId));
      if (reminder.cadence === "ONCE") await db.update(maintenanceReminders).set({ isActive: false, lastRunAt: now }).where(eq4(maintenanceReminders.id, reminder.id));
      else await db.update(maintenanceReminders).set({ nextRunAt: nextReminderDate(reminder.cadence, reminder.nextRunAt), lastRunAt: now }).where(eq4(maintenanceReminders.id, reminder.id));
      results.push({ reminderId: reminder.id, delivery });
    }
    return res.json({ ok: true, processed: results });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  }
}
async function handleMaintenanceReminder(req, res) {
  try {
    const cronUser = await sdk.authenticateRequest(req);
    if (!cronUser.isCron || !cronUser.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "database-unavailable" });
    const reminder = (await db.select().from(maintenanceReminders).where(eq4(maintenanceReminders.scheduleCronTaskUid, cronUser.taskUid)).limit(1))[0];
    if (!reminder) return res.json({ ok: true, skipped: "orphan" });
    const taskUid = reminder.scheduleCronTaskUid;
    if (!taskUid) return res.json({ ok: true, skipped: "missing-task-uid" });
    if (!reminder.isActive) return res.json({ ok: true, skipped: "inactive" });
    const existingRun = (await db.select().from(reminderRuns).where(and3(eq4(reminderRuns.reminderId, reminder.id), eq4(reminderRuns.occurrenceAt, reminder.nextRunAt))).limit(1))[0];
    if (existingRun && isReminderOccurrenceDuplicate(existingRun.occurrenceAt, reminder.nextRunAt)) return res.json({ ok: true, skipped: "already-processed", reminderId: reminder.id, occurrenceAt: reminder.nextRunAt });
    const runInsert = await db.insert(reminderRuns).values({ reminderId: reminder.id, occurrenceAt: reminder.nextRunAt, status: "SENT", sentAt: /* @__PURE__ */ new Date() }).returning({ id: reminderRuns.id });
    const runId = runInsert[0]?.id;
    if (!runId) return res.status(500).json({ error: "execution-ledger-failed" });
    const settings = (await db.select().from(developerSettings).where(eq4(developerSettings.organizationId, reminder.organizationId)).limit(1))[0];
    const recipients = (await db.select().from(users).where(and3(eq4(users.organizationId, reminder.organizationId), eq4(users.role, "TENANT")))).filter((user) => !reminder.unitId || user.unitId === reminder.unitId);
    if (reminder.assignedToId) {
      const assigned = (await db.select().from(users).where(eq4(users.id, reminder.assignedToId)).limit(1))[0];
      if (assigned && !recipients.some((user) => user.id === assigned.id)) recipients.push(assigned);
    }
    const subject = `Maintenance reminder / \u062A\u0630\u0643\u064A\u0631 \u0635\u064A\u0627\u0646\u0629: ${reminder.title}`;
    const text2 = `Maintenance reminder / \u062A\u0630\u0643\u064A\u0631 \u0635\u064A\u0627\u0646\u0629\\n\\n${reminder.title}\\n${reminder.description}\\n\\nPlease review this task in Maintainr.\\n\u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0647\u0630\u0647 \u0627\u0644\u0645\u0647\u0645\u0629 \u0641\u064A Maintainr.`;
    const delivery = { email: 0, sms: 0 };
    for (const recipient of recipients) {
      if (shouldSendReminderChannel("email", settings)) {
        const result = await sendTicketEmail({ event: "MAINTENANCE_REMINDER", recipientEmail: recipient.email, subject, text: text2 });
        if (result.delivered) delivery.email += 1;
      }
      if (shouldSendReminderChannel("sms", settings)) {
        const result = await sendTicketSms({ recipientPhone: recipient.phone, text: text2 });
        if (result.delivered) delivery.sms += 1;
      }
    }
    const sessionToken = parseCookie2(req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    await db.update(reminderRuns).set({ status: "SENT", sentAt: /* @__PURE__ */ new Date() }).where(eq4(reminderRuns.id, runId));
    if (reminder.cadence === "ONCE") {
      await db.update(maintenanceReminders).set({ isActive: false, lastRunAt: /* @__PURE__ */ new Date() }).where(eq4(maintenanceReminders.id, reminder.id));
      await updateHeartbeatJob(taskUid, { enable: false }, sessionToken);
    } else {
      await db.update(maintenanceReminders).set({ nextRunAt: nextReminderDate(reminder.cadence, reminder.nextRunAt), lastRunAt: /* @__PURE__ */ new Date() }).where(eq4(maintenanceReminders.id, reminder.id));
    }
    return res.json({ ok: true, reminderId: reminder.id, delivery });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  }
}

// server/health.ts
function registerHealthRoutes(app) {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "maintainr", database: "not-checked" });
  });
  app.get("/api/health/database", async (_req, res) => {
    const startedAt = Date.now();
    try {
      const db = await getDb();
      if (!db) {
        return res.status(503).json({ ok: false, database: "unavailable", checkedAt: (/* @__PURE__ */ new Date()).toISOString() });
      }
      await db.select({ id: organizations.id }).from(organizations).limit(1);
      return res.json({ ok: true, database: "connected", schema: "reachable", latencyMs: Date.now() - startedAt, checkedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      console.error("[Health] Database check failed", error instanceof Error ? error.message : "unknown error");
      return res.status(503).json({ ok: false, database: "error", schema: "unverified", checkedAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function createApp(options = {}) {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerHealthRoutes(app);
  app.post("/api/scheduled/maintenanceReminder", handleMaintenanceReminder);
  app.post("/api/scheduled/portableMaintenanceReminder", handlePortableMaintenanceReminder);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (options.includeStatic !== false) {
    if (process.env.NODE_ENV === "development") await setupVite(app, server);
    else serveStatic(app);
  }
  return { app, server };
}
async function startServer() {
  const { server } = await createApp();
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
if (process.env.NETLIFY !== "true" && process.env.SERVERLESS_FUNCTION !== "true") startServer().catch(console.error);

// netlify/functions/api.ts
var appPromise = createApp({ includeStatic: false }).then(({ app }) => serverless(app));
async function handler(event, context) {
  const appHandler = await appPromise;
  return appHandler(event, context);
}
export {
  handler
};
