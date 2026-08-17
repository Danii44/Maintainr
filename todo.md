# Project TODO

- [x] Establish the multi-tenant data model for Organizations, Properties, Units, Users, Tickets, TicketMedia, and TicketLog.
- [x] Preserve the exact role labels PROPERTY_MANAGER, TENANT, TECHNICIAN, and FLAT_OWNER.
- [x] Preserve the exact ticket category values PLUMBING, ELECTRICAL, HVAC, APPLIANCE, and OTHER.
- [x] Preserve the exact ticket priority values LOW, MEDIUM, HIGH, and EMERGENCY.
- [x] Preserve the exact ticket status values OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, and CLOSED.
- [x] Implement role-based access control and route guards for all four portals.
- [x] Implement sign-in, sign-up, and the /join-unit onboarding flow.
- [x] Enforce exactly six digits for Unit Access Code values.
- [x] Implement the Property Manager dashboard with Kanban and list views.
- [x] Implement ticket filters for status, priority, and category.
- [x] Implement technician assignment and priority quick actions.
- [x] Implement manager user management for tenant creation, unit-code generation, and technician invitations.
- [x] Implement the Tenant active-ticket progress dashboard.
- [x] Implement searchable Tenant maintenance history.
- [x] Implement Tenant ticket submission with category, description, media upload, and preferred access time.
- [x] Implement the mobile-optimized Technician assigned-jobs portal sorted by urgency.
- [x] Implement Technician job detail, status transitions, proof-photo upload, and mandatory resolution notes.
- [x] Prevent a ticket from reaching RESOLVED without both proof photo and resolution notes.
- [x] Implement full ticket lifecycle transitions and TicketLog audit records.
- [x] Implement secure photo/video storage integration for ticket media.
- [x] Implement transactional email notifications for ticket creation, assignment, status changes, and resolution.
- [x] Build four visually distinct dark professional portal layouts with responsive Tailwind/Shadcn UI.
- [x] Add Framer Motion micro-interactions for status transitions, modals, and progress updates.
- [x] Add Vitest coverage for core authorization, validation, lifecycle, and completion rules.
- [x] Run type checks, tests, and browser visual verification.
- [x] Create a final project checkpoint after all completed items are marked done.

- [x] Implement real sign-in and sign-up routes with authenticated account creation.
- [x] Complete /join-unit account-to-unit binding with database persistence.
- [x] Replace hardcoded seedTickets with database-backed queries and mutations.
- [x] Add full ticket filtering by status, priority, and category.
- [x] Implement searchable tenant history with persisted ticket data.
- [x] Implement ticket submission server actions and real storage uploads.
- [x] Enforce technician completion and RESOLVED validation on the backend.
- [x] Persist status changes and TicketLog audit records through server procedures.
- [x] Expand Vitest coverage to role guards, lifecycle transitions, and backend completion enforcement.
- [x] Restrict ticket status mutations by role and organization and enforce allowed status transitions server-side.
- [x] Block all RESOLVED updates unless proof media and resolution notes are present, regardless of mutation path.
- [x] Create TicketLog entries for ticket creation and every lifecycle transition consistently.
- [x] Add backend tests for lifecycle transitions, organization scoping, and RESOLVED validation bypass attempts.
- [x] Configure email-only notifications as the default free-path delivery channel.
- [x] Keep Twilio SMS/WhatsApp support optional behind environment variables and a feature toggle.
- [x] Add notification environment-variable documentation and safe fallback behavior when credentials are absent.
- [x] Add notification setup documentation listing RESEND_API_KEY, NOTIFICATION_FROM_EMAIL, optional TWILIO_ENABLED, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM, including fallback behavior when credentials are missing.

- [x] Evaluate Firebase Firestore, Authentication, and Storage as an alternative to the current database/auth/storage stack.
- [x] Decide whether Firebase migration is recommended for this project and document tradeoffs.
- [x] Add a simple Arabic/English language switcher available from every portal.
- [x] Add RTL layout support for Arabic and LTR layout support for English.
- [x] Rewrite portal labels, actions, statuses, and empty states in clear bilingual language.
- [x] Simplify navigation so each role sees only the most important actions.
- [x] Test Arabic text rendering, RTL alignment, responsive behavior, and language persistence.

- [x] Create FIREBASE_SETUP.md with console steps, required client environment variables, Firestore rules guidance, and Storage billing notes.
- [x] Create a safe Firebase environment template with empty placeholder values and no credentials.
- [x] Keep the current backend functional when Firebase variables are empty.
- [x] Implement Arabic/English translations and language persistence.
- [x] Implement RTL/LTR direction switching across the application.
- [x] Simplify role navigation and clarify primary actions for all portals.
- [x] Translate all remaining portal copy in Home, Auth, Join Unit, Manager, Tenant, Technician, and Flat Owner screens.
- [x] Localize status, priority, category labels, form placeholders, toast messages, and help text.
- [x] Audit Arabic mode across sidebars, headers, tables, cards, forms, spacing, and alignment for RTL correctness.
- [x] Wire /join-unit UI to the backend onboarding procedure and persist unit binding before redirecting tenants.
- [x] Replace seedTickets across manager, tenant, technician, and owner portals with authenticated tRPC queries and mutations.
- [x] Connect tenant media uploads and technician proof-photo uploads to the secure storage procedure and persist TicketMedia records.
- [x] Perform explicit Arabic-mode QA by switching to Arabic and validating RTL layouts across all portals at desktop and mobile sizes.
- [x] Add the missing RESOLVED to CLOSED server transition and verify all required status paths.
- [x] Create TicketLog entries for ticket creation and every lifecycle transition consistently.
- [x] Replace the hardcoded technician ticket ID with the selected persisted ticket ID for upload and completion.
- [x] Add backend tests for ticket creation logs, RESOLVED to CLOSED, organization scoping, and completion bypass attempts.
- [x] Align shared lifecycle rules with server rules so only RESOLVED can transition to CLOSED.
- [x] Add mutation-level tests for valid RESOLVED-to-CLOSED and invalid direct-close bypass paths.
- [x] Initialize technician detail state from the first live assigned job instead of defaulting to 1046.
- [x] Drive technician detail title, unit, category, priority, and status from the selected live job.
- [x] Verify technician selection keeps proof upload and completion mutations aligned with the displayed job.
- [x] Sync technician detail status whenever the selected live job changes.
- [x] Add focused verification that technician selection keeps displayed job, proof upload, and completion target aligned.
- [x] Audit the technician detail pane for remaining hardcoded job content.
- [x] Drive technician header summary, current time metadata, and current-job context from selected live data or neutral localized labels instead of fixed job-specific copy.
- [x] Add focused technician selection verification for displayed job, proof upload target, and completion target alignment.
- [x] Let tenants select media before submission and attach all selected files after the ticket is created.
- [x] Remove the misleading single-file behavior or support all selected files with upload progress and errors.
- [x] Add focused tenant ticket-plus-media workflow verification.
- [x] Handle partial tenant media upload failures separately from successful ticket creation.
- [x] Add per-file tenant media upload progress, success, failure, and retry states.
- [x] Add focused tenant ticket-plus-multi-file attachment verification, including attachment failure handling.
- [x] Verify and document that sign-up creates a new account through the OAuth callback and user upsert flow.
- [x] Add focused sign-in versus sign-up route validation and first-time onboarding coverage.
- [x] Replace the manager ticket-card window.prompt assignment flow with a proper selectable technician UI, validation, loading, and error states.
- [x] Expose manager assignment and priority actions consistently in Kanban and list views.
- [x] Add focused tests or verification for invalid technician IDs and organization-scoped assignment and priority mutations.
- [x] Add technician-query loading, empty, and error states to manager assignment controls.
- [x] Scope manager technician selection per ticket and show visible pending feedback during assignment.
- [x] Make list-view assignment controls self-contained with their own technician selector.

- [x] Add router/backend tests for tickets.updateStatus and technician.complete covering organization scoping, invalid transitions, RESOLVED bypass rejection, and RESOLVED-to-CLOSED.
- [x] Remove the remaining landing-page seedTickets usage or replace it with clearly non-ticket marketing content.
- [x] Add focused auth verification proving /sign-in launches signIn, /sign-up launches signUp, and first-time tenants complete /join-unit onboarding.
- [x] Update AUTH_FLOW.md to document the distinct sign-in and sign-up OAuth modes.
- [x] Add tenant per-file retry and progress state after partial media upload failures.

- [x] Add a direct tRPC caller test proving tickets.updateStatus rejects status=RESOLVED and routes completion through technician.complete.
- [x] Add a direct tRPC caller test proving tickets.updateStatus rejects cross-organization ticket access.
- [x] Add a tickets.create backend test asserting TicketLog creation on ticket creation and lifecycle audit continuity.

- [x] Fix mobile landing header overflow so brand and actions remain visible at narrow widths.

- [x] Add a focused technician portal verification proving selected job details, proof upload ticketId, and completion ticketId remain aligned.
- [x] Add a focused tenant workflow verification for ticket creation followed by multi-file attachment uploads.
- [x] Add a focused tenant failure-handling verification for retained failed files, retry action, and per-file status transitions.

- [x] Add a dashboard-managed maintenance reminder model with organization, property/unit, assignee, cadence, next-run, active state, and audit metadata.
- [x] Add role-scoped reminder CRUD for property managers and read/acknowledge views for tenants, technicians, and flat owners.
- [x] Add recurring reminder execution through the site’s scheduled callback with idempotent notification delivery and task UID persistence.
- [x] Add bilingual reminder creation, list, empty, validation, and notification copy with Arabic RTL support.
- [x] Preserve role-based post-login routing and separate portal URLs for PROPERTY_MANAGER, TENANT, TECHNICIAN, and FLAT_OWNER.
- [x] Add reminder permission, recurrence, execution, notification, and dashboard integration tests.

- [x] Add developer settings for project name, logo URL, primary/accent theme colors, and bilingual labels.
- [x] Add protected developer controls for email and SMS notification enablement with safe disabled defaults.
- [x] Add environment/setup documentation and secret placeholders for notification provider keys without exposing credential values in the UI.
- [x] Add organization-owner authorization and tests for developer settings reads and updates.

- [x] Add tenant, technician, and flat-owner reminder views with an acknowledge action and role-scoped tests.
- [x] Add reminder execution deduplication before notification delivery so retries cannot resend the same occurrence.
- [x] Localize reminder notification subjects, bodies, and validation/error messages in Arabic and English.
- [x] Add configurable bilingual branding labels to developer settings or explicitly narrow branding scope to project name/logo/colors.
- [x] Change email and SMS channel defaults to disabled until explicitly enabled and configured, with default-state tests.

- [x] Add router and scheduler tests for reminder CRUD, execution deduplication, channel toggles, and dashboard-facing list behavior.
- [x] Restrict developer settings reads to property managers and add direct authorization tests for settings get/update.
- [x] Localize reminder router validation and authorization errors with bilingual error contracts.
- [x] Add tests proving reminder email and SMS channels remain disabled until explicitly enabled and configured.

- [x] Add direct tRPC tests for reminders.list/create/update/remove/acknowledge, including role-scoped dashboard list results.
- [x] Add direct authorization coverage proving non-managers cannot call developer settings.update.
- [x] Localize reminder input validation and manager-only forbidden errors with bilingual contracts and tests.

- [x] Add direct reminder-list tests for TENANT, TECHNICIAN, and FLAT_OWNER organization/unit/assignment scoping.
- [x] Add direct bilingual validation tests for reminder title, description, and due date failures.
- [x] Add direct bilingual forbidden-response tests for manager-only reminder and settings procedures.
- [x] Audit reminder update, remove, and acknowledge validation/error paths for remaining default English-only messages.

- [x] Localize reminders.update, reminders.remove, and reminders.acknowledge invalid-ID validation errors with bilingual contracts.
- [x] Add direct tests for invalid reminder update/remove/acknowledge inputs and verify no default English-only reminder error remains.

- [x] Create a production release checklist covering deployment, domain, provider configuration, backups, security, onboarding, and support operations.
- [x] Add production configuration guidance for Resend email, optional Twilio SMS, scheduled callbacks, branding, and required environment values.
- [x] Add first-run organization onboarding guidance for creating properties, units, roles, invitations, and six-digit unit access codes.
- [x] Add production-safe error handling, audit visibility, and recovery guidance for scheduled reminders and notification failures.
- [x] Verify all role-specific routes, protected settings, reminder permissions, ticket lifecycle rules, media uploads, and Arabic/English flows for release readiness.
- [ ] Create the final distributable checkpoint and handoff instructions; publishing must be completed through the project Publish action.

- [x] Research official setup URLs for Resend, Twilio, Firebase, and production domain/publishing configuration.
- [x] Write a complete Maintainr installation guide with account creation, key retrieval, secret placement, notification setup, Firebase optional setup, and release verification.
- [x] Generate and validate a PDF copy of the installation guide.
- [x] Attach the guide files for the user and record the documentation checkpoint.

- [x] Run and document a release-readiness verification pass across all public, onboarding, role portals, protected settings, reminders, ticket lifecycle, media, and bilingual flows.
- [x] Capture release verification evidence in RELEASE_VERIFICATION.md, including automated test results and authenticated-session limitations.

- [ ] Run authenticated release QA for PROPERTY_MANAGER, TENANT, TECHNICIAN, and FLAT_OWNER across their protected routes.
- [ ] Manually verify protected developer settings, reminder CRUD/acknowledgement, ticket lifecycle, tenant media, and technician proof flows with authenticated accounts.
- [ ] Capture authenticated Arabic/English portal evidence after real role sessions are available.

- [x] Choose and document Netlify as the independent deployment architecture without Manus OAuth or Manus hosting.
- [x] Replace Manus OAuth with self-hosted PostgreSQL email/password authentication and preserve exact role routing.
- [x] Define independent PostgreSQL, S3-compatible media, portable scheduled-reminder, Resend, and optional Twilio integrations for Netlify.
- [x] Add independent environment templates, migration instructions, domain setup, backups, and production deployment configuration.
- [x] Run independent-hosting release verification without a Manus login redirect.

- [x] Audit all MySQL-specific schema builders, Drizzle configuration, migrations, query operators, and environment references.
- [x] Convert the active schema and Drizzle configuration to PostgreSQL without removing required business tables or role fields.
- [x] Generate one standalone PostgreSQL SQL import file with tables, enums, indexes, foreign keys, defaults, and safe idempotent setup.
- [x] Convert server queries and database helpers to PostgreSQL-compatible behavior and document the required DATABASE_URL.
- [x] Remove unused Firebase/legacy configuration and files only after confirming no active code or documentation depends on them.
- [x] Document the remaining independent-auth and deployment migration boundary so no Manus OAuth redirect is mistaken for a standalone release.
- [x] Run PostgreSQL schema/query tests, TypeScript validation, and the full regression suite before saving a migration checkpoint.

- [x] Research official Netlify, Vercel, and cPanel deployment/environment-variable guidance.
- [x] Document PostgreSQL password and secret placement for each supported deployment platform.
- [x] Add database connection and schema-health checks with safe diagnostics that never reveal passwords.
- [x] Design and document an Envato-style license activation boundary without placing a license secret in frontend code.
- [x] Write a platform comparison and complete independent installation guide with deployment, database, auth, storage, reminders, backups, and licensing steps.
- [x] Validate the guide and save a distributable documentation checkpoint.

- [x] Keep purchase-code activation optional and deferred for the private owner-controlled release.
- [x] Prepare owner-only deployment configuration and handoff without requiring a customer license code.
- [ ] Revisit Envato-style licensing only when the product is ready for distribution to external customers.

- [x] Replace Manus OAuth with self-hosted PostgreSQL email/password authentication.
- [x] Add secure password hashing, server-side sessions, logout, and role-preserving redirects for all four portals.
- [x] Add password reset and rate-limiting boundaries with safe environment documentation.
- [x] Add independent-auth schema migration and regression tests without exposing credentials.
- [x] Verify that the independent login flow no longer redirects to Manus OAuth.

- [x] Wire the AppShell sign-out control to use the local logout mutation and verify session revocation plus cookie clearing.
- [x] Add direct auth regression tests for sign-in, sign-up, logout, reset flows, and context-backed auth.me resolution.
- [x] Update the installation, auth-flow, production-release, and environment-template documents to remove stale Manus OAuth guidance and describe self-hosted authentication.

- [x] Select Netlify as the primary independent deployment target and document its runtime boundaries.
- [x] Add Netlify build, redirect, and function configuration for the Maintainr frontend and API.
- [x] Replace platform-specific media storage with an S3-compatible independent storage adapter for Netlify.
- [x] Replace platform-specific reminder scheduling with a portable authenticated cron endpoint suitable for Netlify-compatible external schedulers.
- [x] Add Netlify environment-variable and external-service setup guidance.
- [x] Run Netlify-oriented build, function, schema, and smoke verification.

- [x] Refactor reminder create, update, pause, resume, and delete flows to use the portable external scheduler boundary instead of Manus heartbeat helpers.
- [x] Run explicit Netlify Function smoke checks for API health, database health behavior, scheduled callback authentication, and built schema/runtime artifacts.

- [x] Use Supabase PostgreSQL as the documented demo database option for Maintainr.
- [x] Add a provider-specific Supabase-to-Netlify demo setup walkthrough for all required environment variables.
- [x] Explain safe demo publishing and first-login verification without requiring purchase-code licensing.

- [x] Prepare a public-safe GitHub export for Danii44/Maintainr.git.
- [x] Scan tracked and candidate files for secrets, private tokens, generated output, logs, and local deployment artifacts.
- [x] Add public-repository metadata and exclude secrets and generated artifacts from the upload.
- [x] Push the sanitized project to the authorized public GitHub repository.
- [x] Verify the public repository remote and uploaded contents.

- [x] Fix Supabase import error 42702 caused by ambiguous enum helper variable `value`.
- [x] Validate the corrected PostgreSQL schema and update the public GitHub schema file.
- [x] Provide safe retry instructions for a failed or partially applied Supabase schema import.

- [x] Fix Netlify Function bundling failure from Vite/Tailwind native build dependencies and missing Babel preset resolution.
- [x] Validate a successful Netlify build with the current environment-variable configuration.
- [x] Push the Netlify build fix and document the redeploy step.

- [ ] Diagnose deployed Supabase authentication failure on the users email lookup for test@gmail.com.
- [ ] Verify deployed database schema columns, connection configuration, and auth query compatibility.
- [x] Apply and validate the smallest safe fix, then push the Netlify redeploy update.

- [ ] Rotate the exposed Supabase demo database password and update the Netlify DATABASE_URL without sharing the replacement secret.
- [x] Verify the users table columns and live users-schema status after credential rotation.
- [x] Re-test deployed database health after updating Netlify variables; sign-up remains the next manual step.

- [x] Surface a safe, useful PostgreSQL users-schema diagnostic for the deployed sign-up/sign-in failure without exposing credentials.
- [ ] Verify Manager-created or invited Tenant, Technician, and Flat Owner accounts use separate credentials and correct organization/role scope.
- [x] Validate that no user workflow requires sharing Manager credentials; applicants create separate passwords through single-use invitations.

- [x] Add public Tenant/Technician application intake with bilingual form and email details.
- [x] Add Manager review and approve/reject workflow scoped to the Manager organization.
- [x] Add secure single-use invitation activation so approved users set their own passwords.
- [x] Send bilingual invitation emails without emailing permanent passwords or sharing Manager credentials.
- [x] Add role-scoped account tests and update Supabase schema/deployment documentation.

- [x] Diagnose the live Netlify database health failure reported by maintainr-demo.netlify.app.
- [x] Verify Supabase Transaction pooler URL, password rotation, SSL, and Netlify Functions environment scope without exposing secrets.
- [x] Re-test live database health and authentication after the safe deployment fix.

- [x] Redesign the public home page to explain property maintenance, roles, workflows, and clear entry points in Arabic and English.
- [x] Replace confusing open sign-up and Join your unit-first messaging with a clear applicant/invitation onboarding flow.
- [x] Keep one shared sign-in experience for Tenant and Technician accounts with role-based post-login routing.
- [x] Provide a distinct protected Real Estate Manager administration screen for users, approvals, assignments, password-reset actions, settings, and history.
- [x] Validate the revised public and role-aware navigation on desktop and mobile in both languages.

- [x] Diagnose why maintainr-demo.netlify.app still serves the pre-redesign home page: the latest checkpoint had not yet been pushed to the GitHub remote Netlify uses.
- [x] Verify Netlify is connected to Danii44/Maintainr `main` and push the latest revised checkpoint to that branch.
- [x] Trigger or document the correct Netlify redeploy and verify the updated live home page.

- [x] Email the Property Manager when a Tenant or Technician application is submitted.
- [x] Email the applicant after Manager approval with a bilingual secure invitation link to create their own password.
- [x] Document that dashboard delivery works without Resend, while email delivery requires Resend configuration.

- [x] Add the APPLICATION_SUBMITTED notification event and bilingual emails to both the Property Manager and applicant.
- [x] Update Supabase/Netlify documentation for application-received alerts and secure approval invitations.
- [x] Add regression coverage for the new application notification event’s safe fallback behavior.
- [ ] Complete authenticated release QA for Manager, Tenant, Technician, and Flat Owner accounts on the deployed Netlify site.
- [ ] Create the final distributable checkpoint and provide Publish-action handoff instructions.

- [x] Add and validate a Supabase PostgreSQL seed query for separate Manager, Tenant, Technician, and Flat Owner demo accounts with portal QA data.
- [x] Remove the separate Manager administration public entry point and use one shared role-aware Sign in action with automatic post-login routing.
- [x] Verify the simplified navigation visually and with role-routing regression coverage.
- [x] Rework Manager, Tenant, Technician, and Flat Owner portal layouts for mobile-first use with touch-friendly controls and no horizontal overflow.
- [x] Audit all visible portal buttons and actions for working handlers, loading states, errors, and role-appropriate permissions.
- [ ] Verify cross-role synchronization for users, units, tickets, assignments, reminders, media, audit history, and automatic role routing.
- [x] Add or update regression coverage for repaired mobile and role workflow behavior.
- [ ] Complete responsive screenshots and authenticated role QA for the four demo accounts.
- [x] Remove duplicate sign-in prompts from the public home flow while keeping one shared role-aware login.
- [x] Remove visible demo-only statistics, fake activity, fixed names, and seeded marketing values from production UI without deleting login accounts.
- [x] Simplify dashboards with clear live-data summaries, empty states, and easy role-specific actions.
- [ ] Verify all four role workflows and cross-role synchronization after the cleanup.
- [x] Add a professional Profile area for every role with name/email display, editable profile details, avatar/image support, and password change.
- [x] Move Developer settings out of the standard Manager navigation into a separate owner/developer settings route with automatic branding propagation.
- [x] Remove first-time/demo-looking sign-in copy and reduce post-login delay by routing from the successful auth response without a forced reload.
- [x] Repair Tenant ticket validation, colors, and submission guidance with clear title/detail requirements and accessible controls.
- [x] Replace Technician hard-coded job wording with live assigned-job counts and add profile/password access.
- [ ] Verify all four role dashboards, mobile layouts, branding propagation, and cross-role synchronization after the UX redesign.
- [x] Audit every project file and folder for stale platform-dependent code, demo copy, placeholder actions, deployment inconsistencies, and publish blockers.
- [x] Rewrite public, onboarding, authentication, portal, empty-state, validation, error, and settings copy in a consistent industry-style English/Arabic voice.
- [x] Implement first-run organization branding setup for name, Arabic name, logo, primary color, and accent color, persisted in PostgreSQL and reused globally.
- [x] Generate and propagate a favicon from the configured logo without asking for branding again after first-run setup.
- [x] Update installation, deployment, onboarding, and operator documentation to describe the first-run branding flow and final production behavior.
- [ ] Complete final content, responsive, role, database, build, and publication-readiness verification before the final checkpoint.

- [x] Inspect RunFleet’s public demo/onboarding journey and document relevant self-service workspace patterns without copying its brand or interface.
- [x] Compare Maintainr’s current single-bootstrap organization flow with a multi-workspace SaaS model and define safe organization isolation requirements.
- [x] Design an owner-led self-service real-estate workspace signup flow with one-time organization setup, Manager ownership, and role invitations.
- [x] Implement the approved multi-workspace onboarding changes and add regression coverage for workspace isolation.
- [x] Verify that one organization cannot access another organization’s users, tickets, media, reminders, settings, or branding.

- [x] Add workspace signup fields for Manager identity, organization name, portfolio category, portfolio-size range, and optional first property details.
- [x] Create the organization, first Property Manager, developer-settings defaults, and private session atomically during self-service signup.
- [x] Add a one-time bilingual workspace setup checklist for branding, first property, and unit setup without exposing provider secrets.
- [x] Replace the bootstrap-email-only public registration restriction with safe, rate-limited workspace registration while preserving invitation-only participant accounts.
- [x] Add direct tests for duplicate workspace creator email, cross-organization data isolation, Manager ownership, and invitation scoping.

- [x] Define Maintainr’s professional commercial model across guided demo, self-service SaaS, and separately licensed deployment options.
- [x] Design a safe demo journey that showcases realistic workflows without exposing one customer workspace to another.
- [x] Define product packaging, feature tiers, demo data boundaries, and conversion points for real-estate companies.
- [x] Produce a phased product-readiness roadmap covering product, operations, security, support, billing, and deployment requirements.
