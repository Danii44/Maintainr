-- Maintainr PostgreSQL baseline
-- Import this file into an empty PostgreSQL database owned by your deployment.
-- It is safe to run more than once.

BEGIN;

CREATE OR REPLACE FUNCTION maintainr_create_enum(enum_name text, enum_values text[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  value text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = enum_name) THEN
    EXECUTE format('CREATE TYPE %I AS ENUM (%s)', enum_name, array_to_string(ARRAY(SELECT quote_literal(value) FROM unnest(enum_values) AS value), ', '));
  END IF;
END;
$$;

SELECT maintainr_create_enum('role', ARRAY['PROPERTY_MANAGER','TENANT','TECHNICIAN','FLAT_OWNER']);
SELECT maintainr_create_enum('subscriptionTier', ARRAY['STARTER','GROWTH','ENTERPRISE']);
SELECT maintainr_create_enum('category', ARRAY['PLUMBING','ELECTRICAL','HVAC','APPLIANCE','OTHER']);
SELECT maintainr_create_enum('priority', ARRAY['LOW','MEDIUM','HIGH','EMERGENCY']);
SELECT maintainr_create_enum('status', ARRAY['OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED']);
SELECT maintainr_create_enum('mediaType', ARRAY['IMAGE','VIDEO']);
SELECT maintainr_create_enum('reminderCadence', ARRAY['ONCE','DAILY','WEEKLY','MONTHLY','YEARLY']);
SELECT maintainr_create_enum('reminderRunStatus', ARRAY['PENDING','SENT']);

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "subscriptionTier" "subscriptionTier" NOT NULL DEFAULT 'STARTER',
  "stripeCustomerId" varchar(255),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "properties" (
  "id" serial PRIMARY KEY,
  "organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "address" text NOT NULL,
  "totalUnits" integer NOT NULL DEFAULT 0 CHECK ("totalUnits" >= 0),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "units" (
  "id" serial PRIMARY KEY,
  "propertyId" integer NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "unitNumber" varchar(32) NOT NULL,
  "floorNumber" integer NOT NULL DEFAULT 1,
  "accessCode" varchar(6) NOT NULL UNIQUE CHECK ("accessCode" ~ '^[0-9]{6}$'),
  "ownerId" integer,
  "currentTenantId" integer,
  CONSTRAINT "units_property_number_unique" UNIQUE ("propertyId", "unitNumber")
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "openId" varchar(128) NOT NULL UNIQUE,
  "clerkUserId" varchar(128) UNIQUE,
  "organizationId" integer REFERENCES "organizations"("id") ON DELETE SET NULL,
  "unitId" integer REFERENCES "units"("id") ON DELETE SET NULL,
  "name" varchar(255),
  "email" varchar(320),
  "passwordHash" text,
  "phone" varchar(32),
  "role" "role" NOT NULL DEFAULT 'TENANT',
  "loginMethod" varchar(64),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "lastSignedIn" timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_owner_fk') THEN
    ALTER TABLE "units" ADD CONSTRAINT "units_owner_fk" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_tenant_fk') THEN
    ALTER TABLE "units" ADD CONSTRAINT "units_tenant_fk" FOREIGN KEY ("currentTenantId") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash" varchar(64) NOT NULL UNIQUE,
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "passwordResetTokens" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash" varchar(64) NOT NULL UNIQUE,
  "expiresAt" timestamptz NOT NULL,
  "usedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tickets" (
  "id" serial PRIMARY KEY,
  "organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "unitId" integer NOT NULL REFERENCES "units"("id") ON DELETE RESTRICT,
  "submittedById" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "assignedToId" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "category" "category" NOT NULL,
  "priority" "priority" NOT NULL DEFAULT 'MEDIUM',
  "status" "status" NOT NULL DEFAULT 'OPEN',
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "preferredAccessTime" varchar(255),
  "resolutionNotes" text,
  "resolvedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ticketMedia" (
  "id" serial PRIMARY KEY,
  "ticketId" integer NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "uploadedById" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "mediaUrl" text NOT NULL,
  "mediaType" "mediaType" NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ticketLogs" (
  "id" serial PRIMARY KEY,
  "ticketId" integer NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "actorId" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "action" varchar(64) NOT NULL,
  "message" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "maintenanceReminders" (
  "id" serial PRIMARY KEY,
  "organizationId" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "propertyId" integer REFERENCES "properties"("id") ON DELETE SET NULL,
  "unitId" integer REFERENCES "units"("id") ON DELETE SET NULL,
  "assignedToId" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "createdById" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "cadence" "reminderCadence" NOT NULL DEFAULT 'ONCE',
  "dueAt" timestamptz NOT NULL,
  "nextRunAt" timestamptz NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "scheduleCronTaskUid" varchar(65) UNIQUE,
  "lastRunAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "reminderRuns" (
  "id" serial PRIMARY KEY,
  "reminderId" integer NOT NULL REFERENCES "maintenanceReminders"("id") ON DELETE CASCADE,
  "occurrenceAt" timestamptz NOT NULL,
  "status" "reminderRunStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reminder_runs_occurrence_unique" UNIQUE ("reminderId", "occurrenceAt")
);

CREATE TABLE IF NOT EXISTS "reminderAcknowledgements" (
  "id" serial PRIMARY KEY,
  "reminderId" integer NOT NULL REFERENCES "maintenanceReminders"("id") ON DELETE CASCADE,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "acknowledgedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reminder_ack_reminder_user_unique" UNIQUE ("reminderId", "userId")
);

CREATE TABLE IF NOT EXISTS "developerSettings" (
  "id" serial PRIMARY KEY,
  "organizationId" integer NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "projectName" varchar(120) NOT NULL DEFAULT 'Maintainr',
  "projectNameArabic" varchar(120) NOT NULL DEFAULT 'Maintainr',
  "logoUrl" text,
  "primaryColor" varchar(16) NOT NULL DEFAULT '#8B5CF6',
  "accentColor" varchar(16) NOT NULL DEFAULT '#22D3EE',
  "emailNotificationsEnabled" boolean NOT NULL DEFAULT false,
  "smsNotificationsEnabled" boolean NOT NULL DEFAULT false,
  "updatedById" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "properties_org_idx" ON "properties" ("organizationId");
CREATE INDEX IF NOT EXISTS "users_org_role_idx" ON "users" ("organizationId", "role");
CREATE INDEX IF NOT EXISTS "users_unit_idx" ON "users" ("unitId");
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("userId");
CREATE INDEX IF NOT EXISTS "sessions_expiry_idx" ON "sessions" ("expiresAt");
CREATE INDEX IF NOT EXISTS "password_reset_user_idx" ON "passwordResetTokens" ("userId");
CREATE INDEX IF NOT EXISTS "password_reset_expiry_idx" ON "passwordResetTokens" ("expiresAt");
CREATE INDEX IF NOT EXISTS "tickets_org_status_idx" ON "tickets" ("organizationId", "status");
CREATE INDEX IF NOT EXISTS "tickets_assignee_idx" ON "tickets" ("assignedToId");
CREATE INDEX IF NOT EXISTS "tickets_priority_idx" ON "tickets" ("priority");
CREATE INDEX IF NOT EXISTS "ticket_media_ticket_idx" ON "ticketMedia" ("ticketId");
CREATE INDEX IF NOT EXISTS "ticket_logs_ticket_idx" ON "ticketLogs" ("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "reminders_org_idx" ON "maintenanceReminders" ("organizationId");
CREATE INDEX IF NOT EXISTS "reminders_next_run_idx" ON "maintenanceReminders" ("nextRunAt", "isActive");
CREATE INDEX IF NOT EXISTS "reminder_runs_user_idx" ON "reminderAcknowledgements" ("userId");

CREATE OR REPLACE FUNCTION maintainr_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "users_touch_updated_at" ON "users";
CREATE TRIGGER "users_touch_updated_at" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION maintainr_touch_updated_at();
DROP TRIGGER IF EXISTS "tickets_touch_updated_at" ON "tickets";
CREATE TRIGGER "tickets_touch_updated_at" BEFORE UPDATE ON "tickets" FOR EACH ROW EXECUTE FUNCTION maintainr_touch_updated_at();
DROP TRIGGER IF EXISTS "reminders_touch_updated_at" ON "maintenanceReminders";
CREATE TRIGGER "reminders_touch_updated_at" BEFORE UPDATE ON "maintenanceReminders" FOR EACH ROW EXECUTE FUNCTION maintainr_touch_updated_at();
DROP TRIGGER IF EXISTS "developer_settings_touch_updated_at" ON "developerSettings";
CREATE TRIGGER "developer_settings_touch_updated_at" BEFORE UPDATE ON "developerSettings" FOR EACH ROW EXECUTE FUNCTION maintainr_touch_updated_at();

DROP FUNCTION maintainr_create_enum(text, text[]);

COMMIT;
