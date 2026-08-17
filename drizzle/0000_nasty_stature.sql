CREATE TYPE "public"."category" AS ENUM('PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."mediaType" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');--> statement-breakpoint
CREATE TYPE "public"."reminderCadence" AS ENUM('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."reminderRunStatus" AS ENUM('PENDING', 'SENT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('PROPERTY_MANAGER', 'TENANT', 'TECHNICIAN', 'FLAT_OWNER');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."subscriptionTier" AS ENUM('STARTER', 'GROWTH', 'ENTERPRISE');--> statement-breakpoint
CREATE TABLE "developerSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"projectName" varchar(120) DEFAULT 'Maintainr' NOT NULL,
	"projectNameArabic" varchar(120) DEFAULT 'Maintainr' NOT NULL,
	"logoUrl" text,
	"primaryColor" varchar(16) DEFAULT '#8B5CF6' NOT NULL,
	"accentColor" varchar(16) DEFAULT '#22D3EE' NOT NULL,
	"emailNotificationsEnabled" boolean DEFAULT false NOT NULL,
	"smsNotificationsEnabled" boolean DEFAULT false NOT NULL,
	"updatedById" integer NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developerSettings_organizationId_unique" UNIQUE("organizationId")
);
--> statement-breakpoint
CREATE TABLE "maintenanceReminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"propertyId" integer,
	"unitId" integer,
	"assignedToId" integer,
	"createdById" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"cadence" "reminderCadence" DEFAULT 'ONCE' NOT NULL,
	"dueAt" timestamp with time zone NOT NULL,
	"nextRunAt" timestamp with time zone NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"scheduleCronTaskUid" varchar(65),
	"lastRunAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"subscriptionTier" "subscriptionTier" DEFAULT 'STARTER' NOT NULL,
	"stripeCustomerId" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"totalUnits" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminderAcknowledgements" (
	"id" serial PRIMARY KEY NOT NULL,
	"reminderId" integer NOT NULL,
	"userId" integer NOT NULL,
	"acknowledgedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminderRuns" (
	"id" serial PRIMARY KEY NOT NULL,
	"reminderId" integer NOT NULL,
	"occurrenceAt" timestamp with time zone NOT NULL,
	"status" "reminderRunStatus" DEFAULT 'PENDING' NOT NULL,
	"sentAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"actorId" integer NOT NULL,
	"action" varchar(64) NOT NULL,
	"message" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketMedia" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"uploadedById" integer NOT NULL,
	"mediaUrl" text NOT NULL,
	"mediaType" "mediaType" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"unitId" integer NOT NULL,
	"submittedById" integer NOT NULL,
	"assignedToId" integer,
	"category" "category" NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "status" DEFAULT 'OPEN' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"preferredAccessTime" varchar(255),
	"resolutionNotes" text,
	"resolvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"propertyId" integer NOT NULL,
	"unitNumber" varchar(32) NOT NULL,
	"floorNumber" integer DEFAULT 1 NOT NULL,
	"accessCode" varchar(6) NOT NULL,
	"ownerId" integer,
	"currentTenantId" integer,
	CONSTRAINT "units_accessCode_unique" UNIQUE("accessCode")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(128) NOT NULL,
	"clerkUserId" varchar(128),
	"organizationId" integer,
	"unitId" integer,
	"name" varchar(255),
	"email" varchar(320),
	"phone" varchar(32),
	"role" "role" DEFAULT 'TENANT' NOT NULL,
	"loginMethod" varchar(64),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_clerkUserId_unique" UNIQUE("clerkUserId")
);
--> statement-breakpoint
CREATE INDEX "reminders_org_idx" ON "maintenanceReminders" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "reminders_next_run_idx" ON "maintenanceReminders" USING btree ("nextRunAt","isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_schedule_uid_idx" ON "maintenanceReminders" USING btree ("scheduleCronTaskUid");--> statement-breakpoint
CREATE INDEX "properties_org_idx" ON "properties" USING btree ("organizationId");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_ack_reminder_user_idx" ON "reminderAcknowledgements" USING btree ("reminderId","userId");--> statement-breakpoint
CREATE INDEX "reminder_ack_user_idx" ON "reminderAcknowledgements" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_runs_occurrence_idx" ON "reminderRuns" USING btree ("reminderId","occurrenceAt");--> statement-breakpoint
CREATE INDEX "ticket_logs_ticket_idx" ON "ticketLogs" USING btree ("ticketId","createdAt");--> statement-breakpoint
CREATE INDEX "ticket_media_ticket_idx" ON "ticketMedia" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "tickets_org_status_idx" ON "tickets" USING btree ("organizationId","status");--> statement-breakpoint
CREATE INDEX "tickets_assignee_idx" ON "tickets" USING btree ("assignedToId");--> statement-breakpoint
CREATE INDEX "tickets_priority_idx" ON "tickets" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX "units_property_number_idx" ON "units" USING btree ("propertyId","unitNumber");--> statement-breakpoint
CREATE INDEX "users_org_role_idx" ON "users" USING btree ("organizationId","role");--> statement-breakpoint
CREATE INDEX "users_unit_idx" ON "users" USING btree ("unitId");