# Demo environment operations

## Environment identity

The dedicated demo project is named `maintainr-interactive-demo`. It is a separate Supabase project in Northeast Asia (Tokyo), created only for publicly explorable sample workflows. Its project reference is `jokbmcqkamtrziupolab`. It must not share a database URL, storage bucket/prefix, SMTP credentials, SMS credentials, session cookie, or deployed API environment with production Maintainr.

At creation time, the project was configured with the Data API disabled, automatic exposure of new tables disabled, and automatic Row Level Security enabled. The demo-only schema was applied successfully in the project SQL editor. A private `demo-media` storage bucket was also created in this project; it starts empty and is not a production bucket.

## Before enabling a database-backed public demo

1. Apply `DEMO_ENVIRONMENT_SCHEMA.sql` in the demo project SQL editor only.
2. Configure a separate demo deployment and connect only its database URL through a secret. Do not place the connection string in source control.
3. Use a server-side demo-session route that hashes a random browser token and assigns a 24-hour expiry. Enforce a conservative per-IP creation limit.
4. Generate fictional sample operational records per demo session. Do not send email, SMS, exports, webhooks, payments, or notifications from the demo environment.
5. Run a deterministic scheduled cleanup at least daily against the demo deployment. It must delete expired `demo_sessions`; cascade rules will remove their workspaces, users, tickets, and events. The project now includes the daily `demo-cleanup` scheduled function, which is hard-bound to `DEMO_DATABASE_URL` and does not query production tables.
6. Keep the current static `/demo` preview as the default until both the demo deployment and cleanup run have been verified after deployment.

## Cleanup behavior

The cleanup operation is deterministic: delete sessions where `expires_at < now()` or `revoked_at is not null`. It must be idempotent, it must use only the demo connection, and it must never accept a production organization ID, user ID, or any arbitrary database URL from a request. No public demo-media write route exists yet, so the currently empty `demo-media` bucket has no user-uploaded objects to clean; media deletion must be added atomically with any future demo upload endpoint.

## Validation completed

The application’s isolated-demo lifecycle test connected only through `DEMO_DATABASE_URL`, created fictional Manager, Resident, Technician, Owner, ticket, and timeline records in the separate demo project, revoked the session, ran cleanup, and confirmed the session and cascading workspace records were removed. The test also verifies that the demo connection string is not the production `DATABASE_URL`.
