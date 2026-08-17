# Maintainr commercialization and product-readiness strategy

## Executive recommendation

Maintainr should launch as a **cloud SaaS product with two acquisition paths**, rather than selling only a downloadable software package or offering an unrestricted shared demo. The primary path should let a real-estate company create a private, time-limited trial workspace. The second path should let larger organizations request a guided demonstration and assisted setup. A separately licensed, self-hosted edition should be reserved for a later **Enterprise** offering after licensing, deployment automation, upgrade controls, and enterprise support are mature.

> **Recommended market position:** Maintainr is a bilingual maintenance-operations platform for real-estate teams—not a generic property-management suite. Its first promise is clear ownership of a maintenance request from resident report to verified completion.

This is consistent with public property-management software patterns: Buildium presents both free-trial and demo routes, while TenantCloud places a time-limited trial beside clear role-specific value.[1] [2] RunFleet’s workspace-first intake also supports creating a distinct environment instead of exposing a prospect to a shared customer account.[3]

## The three models

| Model | What the buyer receives | Advantages | Risks and limitations | Recommendation |
|---|---|---|---|---|
| **Guided demo** | A short sales-led walkthrough in a controlled demo workspace. | Best for large portfolios, procurement teams, and buyers who need help mapping their workflow. | Does not scale as the only acquisition path; requires a sales process. | **Launch now.** Add a `Book a demo` enquiry route after the trial path is stable. |
| **Self-service SaaS trial** | A private Maintainr workspace, created from a short intake and usable for a defined trial period. | Scalable, professional, and aligned with the multi-workspace platform now implemented. Lets prospects experience their own branding and process. | Needs plan limits, lifecycle emails, expiry rules, abuse prevention, billing, and support operations. | **Primary launch model.** Build this next. |
| **Separately sold self-hosted software** | Source/build package deployed in the customer’s own infrastructure under an enterprise licence. | Attractive to customers with data residency, procurement, or private-hosting requirements. | Far more support, security, upgrade, and licence-management responsibility; a GitHub repository alone cannot protect the product. | **Defer.** Offer only after SaaS demand and operations are proven. |

## Recommended buyer journey

### 1. Public entry: two clear routes

The public site should expose only two primary decisions:

| Visitor type | Primary action | Outcome |
|---|---|---|
| Small or ready-to-start real-estate company | **Start free workspace** | Creates a private trial organization after email verification. |
| Larger portfolio or organization with a complex rollout | **Book a guided demo** | Collects contact, portfolio size, country/time zone, and implementation needs; sales or support follows up. |

Keep **Sign in** visible but secondary. Tenants, technicians, and owners should never start from the trial path; they enter only through a Manager-approved invitation or application workflow.

### 2. Trial workspace intake

Reuse the existing `/create-workspace` form, but add a deliberate **trial mode** behind it. Ask only for work email, personal name, company name, portfolio category, portfolio-size range, and optionally a first property. Verify the email before activating the trial. Then provision a distinct organization with a trial state and expiry date.

The first Manager should enter a bilingual checklist and experience three immediate “success moments”:

1. Set company identity and add the first property/unit.
2. Invite a technician or submit a sample tenant request.
3. Assign, update, and close one maintenance workflow with evidence.

Maintainr already supports much of this workflow: private organizations, role portals, Manager invitations/applications, tickets, technician completion proof, reminders, branding, and bilingual layout. The trial experience needs lifecycle controls around those existing capabilities rather than a separate product.

### 3. Safe demo data boundary

Do **not** place prospects in a common “demo company” or let one trial organization see another trial organization’s users, tickets, branding, or media. This would undermine the product’s most important SaaS promise.

For an optional interactive demo, create a separate disposable workspace per visitor with clearly labelled **sample operational records**. These may include fictional maintenance scenarios and workflow states, but must not invent customer reviews, ratings, testimonials, or claims. Apply the following controls:

| Control | Purpose |
|---|---|
| Organization-scoped queries and media keys | Prevent cross-workspace disclosure. |
| Trial expiry timestamp and scheduled cleanup | Remove abandoned demo data after the trial window. |
| Email verification and rate limits | Limit automated workspace abuse. |
| Trial-only feature policy | Disable paid integrations, bulk export, external notification sending, and production scheduled messaging until upgrade. |
| Banner and audit label | Make it clear that the workspace is a trial or sample environment. |
| Consent and privacy notice | Explain what trial data is stored, for how long, and how a trial can be deleted. |

## Product packaging: launch simple

Avoid launching with many confusing packages. Use three clear commercial states, then refine pricing only after real customer interviews and usage data.

| Offering | Target organization | Included scope | Conversion objective |
|---|---|---|---|
| **Trial workspace** | Prospects evaluating Maintainr | Core Manager, Tenant, Technician, and Owner workflows with limits on users/properties and a fixed duration. | Prove workflow value and collect an upgrade conversation. |
| **Professional SaaS** | Small to mid-size real-estate companies | Multi-user maintenance operations, branded workspace, media, reminders, onboarding, email support, and standard retention. | Recurring subscription. |
| **Enterprise** | Larger portfolios or regulated organizations | Assisted migration, custom onboarding, stronger reporting/integrations, agreed support response times, and possible self-hosted deployment. | Annual agreement and implementation project. |

The core plan should be organised around **portfolio scale and operational capabilities**, not artificial role-based paywalls. Charging separately for a Tenant or Technician account creates friction because those users are necessary to complete a maintenance workflow. Use reasonable allowances for properties, active units, automation, storage, integrations, and support instead.

## What “full product ready” means for Maintainr

Maintainr’s functional workflow foundation is strong, but a sellable SaaS requires more than working portals. The next work should focus on the commercial operating layer.

| Readiness area | Current foundation | Required before paid SaaS launch |
|---|---|---|
| Workspace and identity | Multi-workspace registration, Manager ownership, branding defaults, role separation. | Email verification, trial state, expiry, organization deletion, and entitlement checks. |
| Workflow product | Requests, assignments, proof, reminders, invitations, profile controls, bilingual UI. | Customer-facing onboarding analytics, import/migration tools, stronger reports, notification preferences, and in-app help. |
| Billing and plans | Not yet implemented. | Subscription provider, secure checkout, plan records, webhook handling, upgrades/downgrades, invoices, and failed-payment policy. |
| Security and privacy | Password hashing, sessions, authorization, organization scoping, database-backed data. | Privacy policy, terms, DPA approach, deletion/export process, audit-log retention policy, monitoring, alerting, backups, and incident process. |
| Operations and support | Installation and Netlify/Supabase documentation exist. | Help centre, support inbox/ticket process, status page, onboarding playbook, service-level policy, and defined customer-success ownership. |
| Enterprise/self-hosting | Independent Netlify/PostgreSQL deployment guide exists. | License service or signed licence validation, release channel, migration runner, upgrade path, container/hosted install automation, telemetry policy, and paid support boundaries. |

## Phased roadmap

### Phase A — Turn the existing workspace flow into a professional trial

Build email verification, `trialStartedAt`, `trialExpiresAt`, `plan`, and `workspaceStatus` fields. Add a trial banner, lifecycle messages, restricted integrations, and scheduled cleanup. Provide a non-destructive sample-workflow generator only for a trial workspace that explicitly opts in.

### Phase B — Convert trial users into paid SaaS customers

Add billing and entitlement enforcement. The checkout must be server-side, webhook-verified, and tied to the organization, never to frontend-only flags. Show a simple plan page that reflects actual included limits and makes an upgrade path clear. Add an account owner role and a billing contact that can differ from the operational Property Manager.

### Phase C — Make operations repeatable

Publish customer onboarding guides, administrator training, a support flow, service-status communication, data export/deletion controls, and incident/recovery procedures. Instrument high-level product events such as workspace created, first property created, first user invited, first ticket resolved, and trial conversion—without collecting unnecessary personal data.

### Phase D — Enterprise and separately sold deployment

Only after the SaaS motion works, add an Enterprise route. Start with assisted private deployments for selected customers, then decide whether a self-hosted licence is commercially justified. The enterprise contract should define support, upgrade cadence, backups, responsibility boundaries, and licence terms. Do not distribute an unrestricted source archive as the first commercial offer.

## Immediate decision

Choose **SaaS-first with a 14-day private trial** as Maintainr’s product direction. Pair it with **Book a guided demo** for larger buyers. Keep self-hosted software as a future Enterprise option rather than the first product you sell.

The next implementation package should be a **Trial and Plans Foundation**: email verification, workspace trial lifecycle, plan/entitlement database model, trial banner and limits, cleanup schedule, privacy copy, and a guided demo request form. Billing should follow after these controls are in place—not before.

## References

[1]: [Buildium — Property Management Software](https://www.buildium.com/)

[2]: [TenantCloud — Property Management Software](https://www.tenantcloud.com/)

[3]: [RunFleet demo research](./RUNFLEET_DEMO_RESEARCH.md)
