# Maintainr

Maintainr is a bilingual property-maintenance operations platform for property managers, tenants, field technicians, and flat owners. It connects maintenance requests, assignments, updates, proof of completion, reminders, onboarding, and audit history in one role-aware workspace.

## Product model

Maintainr uses one secure email/password sign-in for every user. After authentication, the account role determines the destination automatically:

| Role | Portal | Primary responsibility |
|---|---|---|
| Property Manager | `/manager` | Manage people, requests, assignments, priorities, reminders, applications, and workspace identity |
| Tenant | `/tenant` | Report maintenance issues, attach evidence, and follow progress |
| Technician | `/technician` | Review assigned jobs, start work, upload proof, and submit completion notes |
| Flat Owner | `/owner` | Review scoped maintenance performance and export a report |

Prospective tenants and technicians apply through `/apply`. A Manager reviews each application and sends a single-use invitation so the applicant creates a private password. Users never share a role password.

## Independent architecture

Maintainr is designed for independent deployment. The production stack is React, Express, tRPC, Drizzle ORM, PostgreSQL, Netlify Functions, and S3-compatible object storage. Authentication is self-hosted with scrypt password hashing and revocable PostgreSQL-backed sessions. Supabase is supported as the PostgreSQL provider; Supabase Auth is not required.

Notifications use Resend for email and Twilio for optional SMS. Reminder execution uses the portable Netlify Scheduled Function and a callback secret. Provider credentials remain server-side and are never entered into the application UI.

## Installation and deployment

Read [MAINTAINR_INSTALLATION_GUIDE.md](./MAINTAINR_INSTALLATION_GUIDE.md) for the complete production procedure. The provider-specific walkthrough is [SUPABASE_NETLIFY_DEMO.md](./SUPABASE_NETLIFY_DEMO.md). The canonical PostgreSQL definition is [POSTGRESQL_SCHEMA.sql](./POSTGRESQL_SCHEMA.sql).

At minimum, create a PostgreSQL database, apply the schema, connect the repository to Netlify, configure the server-side environment variables, and verify `/api/health` and `/api/health/database`. Use the Netlify build command `pnpm build:netlify` with `dist/public` as the publish directory.

## First-run organization identity

After the first Manager account signs in, open **Workspace settings** and save the organization’s English name, Arabic name, logo URL, primary color, and accent color. Maintainr stores this identity in PostgreSQL and applies it automatically to the public Home, sign-in screen, every portal, page title, theme variables, and browser favicon. The default favicon is used until a logo is saved.

The first-run form is intended for organization setup, not provider secrets. Keep Resend, Twilio, PostgreSQL, S3, and callback credentials in the deployment secret manager.

## Local development

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

Create local environment values from the blank reference templates. Never commit `.env` files or real credentials. Use `DEMO_ACCOUNTS_SEED.sql` only in a disposable QA database; use `REMOVE_DEMO_DATA_KEEP_LOGINS.sql` when you need to remove seeded operational records while preserving the four test login rows.

## Release verification

Before publishing, verify the public Home and sign-in flow, Manager approval and invitation flow, Tenant request creation and attachments, Technician assignment and completion proof, Flat Owner reporting, reminders, password reset, profile updates, branding propagation, Arabic RTL layout, mobile navigation, database health, and Netlify scheduled callbacks. Review [RELEASE_VERIFICATION.md](./RELEASE_VERIFICATION.md) and the generated installation guide PDF before the final release.

## Security boundaries

Use HTTPS everywhere, rotate any credential that has appeared outside the secret manager, restrict S3 permissions, enable PostgreSQL backups, and keep the bootstrap Manager email controlled by the deployment owner. Branding writes and operational administration are Manager-only; role portals receive only the organization data required to render the workspace.
