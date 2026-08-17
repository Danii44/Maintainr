# RunFleet Demo Journey Research

## Public demo flow observed on 2026-08-17

RunFleet’s public **Try Our Free Demo** action opens `https://staging.runfleet.com/demo`. It does not ask a visitor to log into a pre-existing fixed workspace. Instead, it presents a short **Set up your workspace** intake labelled **Free demo · no credit card**.

The intake asks for a work email, property category, number of properties, and optional modules of interest. The available categories include multi-family, retail, hospitality, office, industrial, healthcare, shopping mall, education, data center, and vehicle fleet. Module choices include work orders, maintenance and SLAs, forms, documents, spaces, assets, custom workflows, tenants and vendors, and reporting. Its stated outcome is a realistic workspace generated from four quick answers.

## Product lesson for Maintainr

Maintainr should follow the **workspace-first** idea, not copy the RunFleet brand, UI, content, or data. A prospective real-estate organization should be able to create its own isolated workspace, establish its first Property Manager owner, provide basic portfolio details, select relevant modules, and then invite tenants, technicians, and flat owners. Each organization must have separate users, tickets, units, properties, media keys, reminders, audit records, notification settings, and branding.

## Recommended Maintainr onboarding

1. The organization owner selects **Create a workspace** from the public site.
2. They supply work email, name, organization name, property type, property count range, and optional operating preferences.
3. They verify email and create an individual password.
4. The system creates an organization, assigns the creator `PROPERTY_MANAGER`, creates database-backed branding defaults, and opens a one-time workspace setup checklist.
5. The Manager adds properties and units, sets name/logo/colors, configures provider settings outside the product UI, and invites team members.
6. New participants enter only through a Manager-approved invite or a controlled Tenant/Technician application flow.

## Security boundaries

Self-service organization creation must rate-limit registration, verify the work email, prevent arbitrary elevation to existing organizations, enforce organization ID checks in every query, namespace object storage keys by organization ID, and never permit users to select an organization ID from the browser as an authorization mechanism.

## Sources

- https://www.runfleet.com/
- https://staging.runfleet.com/demo
