// server/reminderScheduler.ts
import { and, eq as eq2, lte } from "drizzle-orm";
import { parse as parseCookie } from "cookie";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
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

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

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

// server/db.ts
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

// server/_core/heartbeat.ts
import { TRPCError } from "@trpc/server";

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
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
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
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
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

// shared/reminderRules.ts
function nextReminderDate(cadence, from) {
  const next = new Date(from);
  if (cadence === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  if (cadence === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  if (cadence === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  if (cadence === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}
function shouldSendReminderChannel(channel, settings) {
  return channel === "email" ? settings?.emailNotificationsEnabled === true : settings?.smsNotificationsEnabled === true;
}
function isReminderOccurrenceDuplicate(existingOccurrence, occurrence) {
  return Boolean(existingOccurrence && existingOccurrence.getTime() === occurrence.getTime());
}

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
    const reminders = await db.select().from(maintenanceReminders).where(requestedId ? eq2(maintenanceReminders.id, requestedId) : and(eq2(maintenanceReminders.isActive, true), lte(maintenanceReminders.nextRunAt, now)));
    const due = requestedId ? reminders : reminders.filter((reminder) => reminder.nextRunAt <= now);
    const results = [];
    for (const reminder of due) {
      const existingRun = (await db.select().from(reminderRuns).where(and(eq2(reminderRuns.reminderId, reminder.id), eq2(reminderRuns.occurrenceAt, reminder.nextRunAt))).limit(1))[0];
      if (existingRun && isReminderOccurrenceDuplicate(existingRun.occurrenceAt, reminder.nextRunAt)) {
        results.push({ reminderId: reminder.id, skipped: "already-processed" });
        continue;
      }
      const runInsert = await db.insert(reminderRuns).values({ reminderId: reminder.id, occurrenceAt: reminder.nextRunAt, status: "SENT", sentAt: now }).returning({ id: reminderRuns.id });
      const runId = runInsert[0]?.id;
      if (!runId) continue;
      const settings = (await db.select().from(developerSettings).where(eq2(developerSettings.organizationId, reminder.organizationId)).limit(1))[0];
      const recipients = (await db.select().from(users).where(and(eq2(users.organizationId, reminder.organizationId), eq2(users.role, "TENANT")))).filter((user) => !reminder.unitId || user.unitId === reminder.unitId);
      if (reminder.assignedToId) {
        const assigned = (await db.select().from(users).where(eq2(users.id, reminder.assignedToId)).limit(1))[0];
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
      await db.update(reminderRuns).set({ status: "SENT", sentAt: now }).where(eq2(reminderRuns.id, runId));
      if (reminder.cadence === "ONCE") await db.update(maintenanceReminders).set({ isActive: false, lastRunAt: now }).where(eq2(maintenanceReminders.id, reminder.id));
      else await db.update(maintenanceReminders).set({ nextRunAt: nextReminderDate(reminder.cadence, reminder.nextRunAt), lastRunAt: now }).where(eq2(maintenanceReminders.id, reminder.id));
      results.push({ reminderId: reminder.id, delivery });
    }
    return res.json({ ok: true, processed: results });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  }
}

// netlify/functions/scheduled-maintenanceReminder.ts
var handler = async (event) => {
  let statusCode = 200;
  let body = "";
  const response = {
    status(code) {
      statusCode = code;
      return response;
    },
    json(value) {
      body = JSON.stringify(value);
      return response;
    }
  };
  await handlePortableMaintenanceReminder({ headers: event.headers, body: event.body ? JSON.parse(event.body) : {} }, response);
  return { statusCode, headers: { "content-type": "application/json" }, body };
};
var config = {
  schedule: "*/15 * * * *"
};
export {
  config,
  handler
};
