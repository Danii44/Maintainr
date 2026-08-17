# Live workspace release status

## Observed public deployment

On 2026-08-17, the public Netlify site at `https://maintainr-demo.netlify.app` served the updated Home page with **Create workspace** actions. The live `/create-workspace` route also rendered the bilingual self-service form with Manager identity, organization name, optional Arabic name, portfolio category, portfolio-size range, and optional first-property fields.

No live registration form was submitted during this verification. Submitting one would create an external organization and user account, so it requires a deliberate production-test decision.

## Required Supabase migration before live submission

Apply the following migration once in the Supabase SQL editor for an existing database before testing workspace submission:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "portfolioCategory" varchar(64);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "portfolioSizeRange" varchar(24);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" timestamptz;
```

After it succeeds, create a disposable workspace in a private browser session and verify the Manager redirects to `/manager`, sees the setup checklist, and that a second workspace cannot see the first workspace’s data.
