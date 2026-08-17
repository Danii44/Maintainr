CREATE TABLE "passwordResetTokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passwordResetTokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "passwordResetTokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "password_reset_expiry_idx" ON "passwordResetTokens" USING btree ("expiresAt");