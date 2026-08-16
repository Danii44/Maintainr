import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, index, uniqueIndex } from "drizzle-orm/mysql-core";

export const roleEnum = mysqlEnum("role", ["PROPERTY_MANAGER", "TENANT", "TECHNICIAN", "FLAT_OWNER"]);
export const subscriptionTierEnum = mysqlEnum("subscriptionTier", ["STARTER", "GROWTH", "ENTERPRISE"]);
export const categoryEnum = mysqlEnum("category", ["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "OTHER"]);
export const priorityEnum = mysqlEnum("priority", ["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);
export const statusEnum = mysqlEnum("status", ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export const mediaTypeEnum = mysqlEnum("mediaType", ["IMAGE", "VIDEO"]);

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subscriptionTier: subscriptionTierEnum.notNull().default("STARTER"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  totalUnits: int("totalUnits").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ organizationIdx: index("properties_org_idx").on(table.organizationId) }));

export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  unitNumber: varchar("unitNumber", { length: 32 }).notNull(),
  floorNumber: int("floorNumber").notNull().default(1),
  accessCode: varchar("accessCode", { length: 6 }).notNull().unique(),
  ownerId: int("ownerId"),
  currentTenantId: int("currentTenantId"),
}, (table) => ({ propertyUnitIdx: uniqueIndex("units_property_number_idx").on(table.propertyId, table.unitNumber) }));

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  clerkUserId: varchar("clerkUserId", { length: 128 }).unique(),
  organizationId: int("organizationId"),
  unitId: int("unitId"),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  role: roleEnum.notNull().default("TENANT"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({ orgRoleIdx: index("users_org_role_idx").on(table.organizationId, table.role), unitIdx: index("users_unit_idx").on(table.unitId) }));

export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  unitId: int("unitId").notNull(),
  submittedById: int("submittedById").notNull(),
  assignedToId: int("assignedToId"),
  category: categoryEnum.notNull(),
  priority: priorityEnum.notNull().default("MEDIUM"),
  status: statusEnum.notNull().default("OPEN"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  preferredAccessTime: varchar("preferredAccessTime", { length: 255 }),
  resolutionNotes: text("resolutionNotes"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ orgStatusIdx: index("tickets_org_status_idx").on(table.organizationId, table.status), assigneeIdx: index("tickets_assignee_idx").on(table.assignedToId), priorityIdx: index("tickets_priority_idx").on(table.priority) }));

export const ticketMedia = mysqlTable("ticketMedia", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  uploadedById: int("uploadedById").notNull(),
  mediaUrl: text("mediaUrl").notNull(),
  mediaType: mediaTypeEnum.notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ ticketIdx: index("ticket_media_ticket_idx").on(table.ticketId) }));

export const ticketLogs = mysqlTable("ticketLogs", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  actorId: int("actorId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ ticketLogIdx: index("ticket_logs_ticket_idx").on(table.ticketId, table.createdAt) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
