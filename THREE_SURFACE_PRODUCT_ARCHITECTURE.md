# Maintainr three-surface product architecture

## Purpose

Maintainr will operate as three related but distinct experiences. A visitor first understands the product on the public website, then may explore a safe interactive demo, and finally creates or enters a real workspace. The public site and demo must never provide a path into another company’s production data.

| Surface | Audience | URL now | Data source | Permitted actions |
|---|---|---|---|---|
| **Marketing site** | Any visitor | `/` | No customer records; public product content only. | Read features, view product motion tour, choose demo, trial, or guided-demo route. |
| **Interactive demo** | Prospects | `/demo` | Dedicated **demo-only database** and demo-only media storage. | Explore sample Manager, Tenant, Technician, and Owner workflows; reset sample state. |
| **Production SaaS** | Real customers | `/create-workspace`, `/sign-in`, protected role routes | Production Supabase database and production storage. | Create a real organization, invite participants, and manage live maintenance operations. |

## Non-negotiable boundaries

The demo must not query the production database, production storage bucket, production email provider, or production notification/scheduled-job routes. It needs its own `DEMO_DATABASE_URL`, `DEMO_*` storage credentials or bucket/prefix, a separate session cookie name, and a demo-only public API boundary. A demo account cannot be upgraded into a production customer account by changing a role or organization flag; conversion should create a fresh production workspace or explicitly migrate verified customer-owned data through a controlled operator flow.

| Area | Marketing | Demo | Production SaaS |
|---|---|---|---|
| Authentication | None | Disposable demo session or limited demo account | Hashed-password account and revocable production session |
| Database | None | Separate Supabase project/database | Production Supabase project/database |
| Media | Public optimized assets only | Demo-only bucket/prefix | Production organization-scoped keys |
| Email/SMS | Demo request notifications only | Disabled or routed to a safe internal sink | Customer-configured provider paths |
| Scheduled tasks | None | Demo cleanup only | Reminder and operational scheduling |
| Data retention | Public assets | Short TTL; reset automatically | Customer retention and deletion policy |

## Demo data policy

The demo database may contain fictional, clearly labelled **sample operational records**: properties, units, maintenance requests, technician updates, completion photos, and reminders. It must not contain customer records, copied production data, fabricated reviews, ratings, testimonials, or claims of customer results. External delivery actions must remain disabled.

## Deployment progression

1. **Current phase:** one Netlify deployment with public marketing at `/`, a client-side interactive demo shell at `/demo`, and production SaaS routes protected by the existing production API.
2. **Public-demo phase:** deploy a second Netlify site or function set for `demo.maintainr.example`, using a separate Supabase project and distinct environment variables. Enable demo state reset and TTL cleanup there.
3. **Commercial phase:** use `app.maintainr.example` for production SaaS and `www.maintainr.example` for marketing. The separate domains make the data and operational boundary clear to customers and operators.

## Required controls before a public database-backed demo launches

- Verify a demo-only Supabase project and storage configuration.
- Add a `demo_sessions` lifecycle table and a rate-limited creation endpoint.
- Seed only labelled sample records; never copy production records.
- Block email, SMS, payment, export, and external webhooks from the demo environment.
- Automatically expire and remove inactive demo sessions and media.
- Add browser and API regression tests proving demo routes cannot call production organization data.
