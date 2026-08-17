# Maintainr Netlify Deployment Guide

## Architecture

Netlify hosts the Vite frontend and the serverless API Functions. PostgreSQL remains an external database, and media bytes are stored in an S3-compatible bucket. Netlify Scheduled Functions invoke the portable reminder callback every fifteen minutes. The application keeps its local PostgreSQL authentication model: passwords are hashed on the server, session hashes and reset-token hashes are stored in PostgreSQL, and no Manus OAuth redirect is required.

| Component | Netlify/private deployment choice |
|---|---|
| Frontend | Vite build published from `dist/public` |
| API | `netlify/functions/api.ts`, wrapped around the shared Express/tRPC app |
| Database | External PostgreSQL using `DATABASE_URL` with SSL |
| Media | S3-compatible storage using `S3_*` server variables |
| Recurring reminders | `scheduled-maintenanceReminder` Netlify Scheduled Function |
| Email | Resend using server-only variables |
| SMS | Optional Twilio using server-only variables |
| Licensing | Deferred for private owner use |

## Netlify site settings

Connect the repository to Netlify and use the repository’s `netlify.toml`. The build command is `pnpm build:netlify`, the publish directory is `dist/public`, and Functions are read from `netlify/functions`. Netlify’s Vite documentation and Functions documentation are listed in the references below.[1] [2]

The redirect in `netlify.toml` sends `/api/*` requests to the API Function while the SPA fallback sends non-API routes to `index.html`. Keep the API Function server-only; do not import server modules into client code.

## Environment variables

Set these values in the Netlify site environment-variable settings, not in the repository and not as `VITE_` variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, preferably with `sslmode=require` |
| `BOOTSTRAP_MANAGER_EMAIL` | First signup email that receives `PROPERTY_MANAGER` |
| `AUTH_BASE_URL` | Public HTTPS URL used in password-reset links |
| `RESEND_API_KEY` | Password-reset and notification delivery |
| `NOTIFICATION_FROM_EMAIL` | Verified Resend sender |
| `S3_BUCKET` | S3 bucket name |
| `S3_REGION` | S3 region, default `us-east-1` |
| `S3_ENDPOINT` | Optional endpoint for Cloudflare R2, MinIO, Wasabi, or another S3-compatible service |
| `S3_ACCESS_KEY_ID` | S3 access key |
| `S3_SECRET_ACCESS_KEY` | S3 secret key |
| `S3_PUBLIC_BASE_URL` | Optional public base URL; omit when using signed URLs |
| `REMINDER_CALLBACK_SECRET` | Secret used by the scheduled reminder Function |
| `TWILIO_ENABLED` | `false` until SMS is configured and tested |
| `TWILIO_ACCOUNT_SID` | Optional Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Optional Twilio secret |
| `TWILIO_FROM` | Optional SMS-capable sender number |

Netlify documents that environment variables are available to Functions, including scheduled Functions.[2] Do not expose any of these values through `VITE_` variables.

## PostgreSQL setup

Create an empty PostgreSQL database, import `POSTGRESQL_SCHEMA.sql`, and verify the thirteen tables, including `sessions` and `passwordResetTokens`. Set `DATABASE_URL` in Netlify after importing the schema. Use a least-privilege application role and enable automated backups.

Before the first signup, set `BOOTSTRAP_MANAGER_EMAIL`. Sign up with that address through `/sign-up`; the account receives `PROPERTY_MANAGER`. Configure `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` before testing `/forgot-password`.

## S3 storage setup

Create a private bucket or a bucket with a controlled public base URL. For private buckets, leave `S3_PUBLIC_BASE_URL` empty; Maintainr returns short-lived signed URLs for reads. Grant the application key only the minimum `PutObject` and `GetObject` permissions required for the bucket prefix. If using an S3-compatible service with a custom endpoint, set `S3_ENDPOINT` and use a region accepted by that service.

The storage adapter generates collision-resistant keys and never stores file bytes in PostgreSQL. Existing `/manus-storage/...` paths remain readable for managed-preview compatibility, while independent uploads use the `/storage/...` path or the returned S3 URL.

## Scheduled reminders

Netlify detects the exported `config.schedule` on `netlify/functions/scheduled-maintenanceReminder.ts`. The current schedule is every fifteen minutes. The function calls the portable callback with `x-maintainr-cron-secret`, processes all active reminders whose `nextRunAt` is due, records an occurrence ledger row, sends enabled notifications, and advances or disables the reminder. The occurrence unique constraint makes retries idempotent.

The scheduled function is intentionally separate from the old Manus heartbeat callback. No in-process timer is used. If the project later needs a different cadence, change the Function schedule and keep the database occurrence ledger as the source of truth.

## Netlify limitations and next step

The shared Express server remains useful for local development and cPanel-style Node hosting. On Netlify, use the Function entrypoint for `/api/*`; do not expect a long-lived Express listener, local filesystem persistence, or in-process background jobs. S3 is the only supported media-byte store for the independent Netlify deployment.

After the first Netlify deploy, test `/api/health`, `/api/health/database`, `/sign-in`, `/sign-up`, `/forgot-password`, `/join-unit`, all four role routes, media upload, and the scheduled Function logs. Purchase-code licensing remains intentionally deferred for private use.

## References

[1]: https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/ "Netlify: Vite framework setup"
[2]: https://docs.netlify.com/build/functions/environment-variables/ "Netlify: Environment variables and serverless functions"
[3]: https://docs.netlify.com/build/functions/scheduled-functions/ "Netlify: Scheduled Functions"
[4]: https://docs.netlify.com/build/functions/overview/ "Netlify: Functions overview"
