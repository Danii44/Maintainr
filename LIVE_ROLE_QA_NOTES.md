# Live Role QA Notes

Date: 2026-08-17

The deployed `https://maintainr-demo.netlify.app` accepted the seeded Manager credentials and automatically routed to `/manager`, confirming shared sign-in and Manager role routing work in production.

The deployed Manager page showed the older UI: the public home page still displayed a separate `Manager administration` button, and the Manager portal still displayed `New ticket` and the unused slider-control button. These are absent or repaired in the current local project changes, so the deployed site has not yet received the latest checkpoint/build.

The live Manager portal loaded the seeded demo ticket `MT-1` and showed Manager navigation, account access, ticket filters, assignment, and priority controls. Authenticated Tenant, Technician, and Flat Owner live QA remains pending because the Manager session was signed out before those sessions were tested.

## Latest deployed home check

URL checked: https://maintainr-demo.netlify.app/

The current deployed version still shows `Sign in`, `Apply for access`, a separate `Manager administration` button in the header, a second `Manager administration` hero action, and a separate `Sign in to your portal` hero action. It also still displays fixed marketing/demo values: `4 role-based portals`, `100% ticket traceability`, `24/7 visibility`, `98.4% SLA`, and fixed feature-card copy. This confirms the cleaned local checkpoint has not reached the deployed site yet.

## 2026-08-17 local preview follow-up

The current validated preview sign-in page renders the new single role-aware sign-in copy correctly. Submitting the Manager demo credentials fails before authentication with a users query error because the running preview database does not expose the PostgreSQL `users.avatarUrl` field. The project database SQL tool is connected to a MySQL/TiDB-compatible managed preview database, while the distributable runtime is PostgreSQL/Supabase. A MySQL-compatible preview column was added, but `/api/health/database` still reports `{ok:false,database:"error",schema:"unverified"}`; the runtime is therefore not using the same database target. The Supabase guide now documents the required PostgreSQL `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" text;` migration. Authenticated four-role QA must be performed after the PostgreSQL-backed Netlify deployment is updated.
