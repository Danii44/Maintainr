# Maintainr Release-Readiness Audit

## Executive status

Maintainr is structurally ready for an owner-controlled publish review. The release uses self-hosted PostgreSQL authentication, Netlify Functions, S3-compatible storage, a portable scheduled-reminder callback, bilingual English/Arabic UI, role-aware routing, and database-backed organization branding. The remaining release gate is authenticated verification against the current deployed Netlify build.

## Completed validation

| Area | Evidence | Result |
|---|---|---|
| TypeScript | `pnpm check` | Passed |
| Automated regression | `pnpm test` | 50 tests passed across 16 files |
| Netlify bundle | `pnpm build:netlify` | Passed |
| Public and auth UI | Desktop and 390px mobile screenshots | Passed visual review |
| Role guards | Protected `/manager`, `/tenant`, `/technician`, and `/owner` routes | Unauthenticated access is guarded |
| Authentication | Local email/password procedures and role routing | No external OAuth redirect in the active flow |
| Branding | PostgreSQL `developerSettings`, public read, Manager-only write | First-run setup and dynamic favicon implemented |
| Profile | Name, phone, password, avatar URL, and S3-backed image upload | Implemented |
| Scheduling | Netlify-compatible callback-secret handler and occurrence deduplication | Implemented and tested |

## First-run operator procedure

After creating the first Manager account, open **Workspace settings** and save the organization’s English name, Arabic name, logo, primary color, and accent color. These values are stored in PostgreSQL and automatically appear on the public Home, sign-in screen, every role portal, page title, theme variables, and favicon. Provider secrets belong in the hosting secret manager and are never entered into the branding form.

## Required live release gate

Publish the latest checkpoint to Netlify, then use separate authenticated accounts for Property Manager, Tenant, Technician, and Flat Owner. Verify profile editing and image upload, password change, Manager application approval, Tenant request creation and attachments, Technician assignment and completion proof, Flat Owner reporting, reminders and acknowledgements, Arabic RTL behavior, branding propagation, and cross-role ticket synchronization. Record any live-only issue before external distribution.

## Demo-data safety

`DEMO_ACCOUNTS_SEED.sql` is for disposable QA databases only. `REMOVE_DEMO_DATA_KEEP_LOGINS.sql` removes seeded operational records while preserving the four demo login rows. Do not run either file against a production database without a backup and explicit operator approval.
