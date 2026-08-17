ALTER TABLE "organizations" ADD COLUMN "portfolioCategory" varchar(64);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "portfolioSizeRange" varchar(24);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "onboardingCompletedAt" timestamp with time zone;