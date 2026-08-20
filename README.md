# Maintainr — Original Core Repository

Maintainr is a bilingual property-maintenance platform for **Property Managers**, **Tenants**, **Technicians**, and **Flat Owners**. This repository is the original core implementation and PostgreSQL baseline. For a new customer-facing deployment, use the two maintained standalone repositories instead.

| Product | Repository | Purpose |
|---|---|---|
| Production application | `Danii44/Maintainr_Saas` | Secure multi-workspace SaaS portals and operational workflows. |
| Public commercial site | `Danii44/Maintainr_commercial` | Marketing website, quotation intake, and isolated demonstration environment. |

> **Important:** The original core repository is retained as a reference baseline. Do not connect it to the commercial database, and do not use it as the source for a new standalone deployment when `Maintainr_Saas` is available.

## Product flow

The Manager creates a workspace, adds properties and units, configures workspace branding, and manages users. Tenants report maintenance issues with optional evidence. Managers assign work and priorities. Technicians update progress, upload completion proof, and add resolution notes. Flat Owners can view the maintenance activity scoped to their assigned unit. Every operational change is stored in the organization-scoped audit history.

| Role | Route | What the user does |
|---|---|---|
| Property Manager | `/manager` | Manages requests, people, assignments, reminders, and workspace identity. |
| Tenant | `/tenant` | Submits maintenance requests, adds media, and follows progress. |
| Technician | `/technician` | Works assigned jobs, uploads proof, and records completion notes. |
| Flat Owner | `/owner` | Reviews the maintenance record for the assigned unit. |

## Required services

You need Node.js 20 or later, pnpm, and an independent PostgreSQL database. Email, SMS, S3-compatible storage, and reminder scheduling are optional integrations that must be configured only through server-side deployment secrets. Never commit database URLs, password-reset secrets, API keys, S3 credentials, or production `.env` files.

## Database installation

Create an empty PostgreSQL database that you control, then import the canonical baseline:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f POSTGRESQL_SCHEMA.sql
```

The schema provisions roles, organizations, properties, units, accounts, sessions, tickets, media metadata, audit logs, reminders, acknowledgement records, and workspace settings. `DEMO_ACCOUNTS_SEED.sql` and `DEMO_ENVIRONMENT_SCHEMA.sql` are optional development-only helpers; never apply them to a customer database.

## Server-side configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Long random secret for signing sessions. |
| `AUTH_BASE_URL` | Public HTTPS URL used in reset links. |
| `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` | Optional email delivery. |
| `TWILIO_*` | Optional SMS delivery. |
| `S3_*` | Optional customer media storage. |
| `REMINDER_CALLBACK_SECRET` | Protects the reminder callback endpoint. |
| `DEMO_DATABASE_URL` | Legacy isolated-demo integration-test database only; it is never a customer workspace database. |

## Local development and validation

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

Use `pnpm build:netlify` to verify the Netlify function bundle before a user-controlled deployment. The default test suite is deterministic and does not contact the legacy demo database. To deliberately run the external demo integration tests, configure a reachable, separately isolated `DEMO_DATABASE_URL` and set `RUN_DEMO_DATABASE_INTEGRATION=true`. The standalone SaaS and commercial repositories do not depend on that legacy test database. This repository does not publish automatically.

## Security and release checks

Use HTTPS, enforce database backups, use least-privilege PostgreSQL and S3 credentials, and keep provider secrets server-side. Before publication, verify account routing, workspace isolation, tenant request creation, manager assignment, technician proof requirements, owner scoping, reminder permissions, password reset, Arabic RTL rendering, mobile navigation, and database health.

## Kept project structure

The retained folders are required by runtime, build, tests, migration tooling, or Netlify deployment: `client/`, `server/`, `shared/`, `drizzle/`, `netlify/`, `scripts/`, `patches/`, and the root configuration files. No generated build output, runtime logs, credentials, or provider secrets belong in Git.
