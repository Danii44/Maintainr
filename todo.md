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
