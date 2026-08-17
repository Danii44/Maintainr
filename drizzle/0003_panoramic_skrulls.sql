CREATE TABLE "accountInvitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"requestedRole" "role" NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(32),
	"unitId" integer,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdById" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accountInvitations_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "roleApplications" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer,
	"requestedRole" "role" NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(32),
	"message" text,
	"status" varchar(24) DEFAULT 'PENDING' NOT NULL,
	"requestedUnitId" integer,
	"reviewedById" integer,
	"reviewedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_invites_email_idx" ON "accountInvitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "account_invites_expiry_idx" ON "accountInvitations" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "role_applications_status_idx" ON "roleApplications" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "role_applications_email_idx" ON "roleApplications" USING btree ("email");