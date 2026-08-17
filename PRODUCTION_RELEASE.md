# Maintainr Production Release

Maintainr’s PostgreSQL-first private release is prepared for independent deployment. The target architecture uses the standalone PostgreSQL schema, self-hosted email/password authentication, S3-compatible media storage, an independently operated scheduled worker, Resend for email delivery, and optional Twilio SMS. Purchase-code activation is intentionally deferred because this installation is for the owner’s private use.

## Release configuration

| Area | Required action | Owner |
|---|---|---|
| Application | Set the production project name, Arabic project name, logo URL, primary color, and accent color in Developer Settings. | Organization owner |
| Database | Import `POSTGRESQL_SCHEMA.sql`, create a least-privilege PostgreSQL user, enable SSL, backups, and set `DATABASE_URL` only in server-side secrets. | Project administrator |
| Authentication | Set `BOOTSTRAP_MANAGER_EMAIL` before the first signup and set `AUTH_BASE_URL` to the public HTTPS URL. Verify local `/sign-in`, `/sign-up`, `/forgot-password`, and `/reset-password` flows. | Project administrator |
| Email | Add `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` through managed secrets, then test password reset and a maintenance reminder. | Project administrator |
| SMS | Leave SMS disabled unless Twilio is configured and the organization explicitly enables it. | Organization owner |
| Scheduling | Configure the deployment’s cron or worker adapter before expecting recurring reminder callbacks to execute. | Project administrator |
| Domain | Bind a production domain and verify sign-in, sign-up, `/join-unit`, and each role portal. | Project administrator |
| Storage | Configure an independent S3-compatible storage adapter and confirm ticket photos, videos, and proof media can be uploaded and retrieved. | Project administrator |

## First-run organization setup

Set `BOOTSTRAP_MANAGER_EMAIL` to the owner’s email before creating the first account. Sign up through `/sign-up`; that account receives `PROPERTY_MANAGER`. The manager should then create the organization’s properties and units, generate six-digit access codes for tenant onboarding, invite technicians and tenants, and confirm every invited user receives the expected role. Each user is routed to a role-specific portal after authentication: `/manager`, `/tenant`, `/technician`, or `/owner`.

## Authentication and recovery

Passwords are hashed server-side with scrypt. Session tokens are random, stored only as hashes in PostgreSQL, expire, and can be revoked. The portal sign-out control revokes the current session before returning to the home page. Password-reset requests use a generic response so account existence is not disclosed; reset tokens are single-use, time-limited, and sent only when Resend is configured. If multiple application instances are later deployed, move rate limiting from process memory to a shared store.

## Notification rollout

Start with email notifications only. Test password reset, ticket creation, assignment, status updates, technician completion, and maintenance reminders. Enable SMS only after the email workflow is stable and Twilio credentials have been added. Reminder execution is idempotent through an occurrence ledger, so a retry does not intentionally send the same occurrence twice.

## Release verification

Before private use, import the SQL into a disposable PostgreSQL database, configure a test `DATABASE_URL`, verify both health endpoints, create the bootstrap manager, create a tenant, bind a six-digit unit code, create and complete a ticket with proof media, create and acknowledge a reminder, test logout and password reset, test Arabic RTL mode, and validate mobile layouts. Confirm that no browser network response contains `DATABASE_URL`, password hashes, provider tokens, reset tokens, or license secrets.

## Operations and recovery

Review production logs after the first scheduled callback and after the first notification batch. If a provider is unavailable, the application should retain reminder state and surface the failure through logs rather than exposing credentials in the dashboard. Keep database backups enabled, rotate provider secrets when staff access changes, and maintain a manager recovery path through the database and password-reset process.

Publishing is completed by the project owner through the project’s **Publish** action after reviewing the latest checkpoint. This workspace does not publish automatically.
