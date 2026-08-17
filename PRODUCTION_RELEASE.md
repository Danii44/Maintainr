# Maintainr Production Release Guide

Maintainr is ready to be distributed through the project’s managed hosting workflow. The current architecture uses the built-in managed MySQL/TiDB database, Manus OAuth, S3-compatible media storage, the Maintainr scheduled callback for recurring reminders, Resend for email delivery, and optional Twilio SMS. Firebase is not required for release and should only be introduced later if a deliberate backend migration is approved.

## Release configuration

| Area | Required action | Owner |
|---|---|---|
| Application | Set the production project name, Arabic project name, logo URL, primary color, and accent color in Developer Settings. | Organization owner |
| Authentication | Confirm the production OAuth application and callback configuration. | Project administrator |
| Email | Add `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` through managed secrets, then send a test reminder. | Project administrator |
| SMS | Leave SMS disabled unless Twilio is configured and the organization explicitly enables it. | Organization owner |
| Scheduling | Publish the project before expecting scheduled reminder callbacks to execute. | Project administrator |
| Domain | Bind a production domain and verify sign-in, sign-up, `/join-unit`, and each role portal. | Project administrator |
| Storage | Confirm ticket photos, videos, and proof media can be uploaded and retrieved through S3 storage. | Project administrator |

## First-run organization setup

A property manager should create the organization’s properties and units, generate six-digit access codes for tenant onboarding, invite technicians and tenants, and confirm every invited user receives the expected role. Each user is routed to a role-specific portal after authentication: `/manager`, `/tenant`, `/technician`, or `/owner`.

## Notification rollout

Start with email notifications only. Test ticket creation, assignment, status updates, technician completion, and maintenance reminders. Enable SMS only after the email workflow is stable and Twilio credentials have been added. Reminder execution is idempotent through an occurrence ledger, so a retry does not intentionally send the same occurrence twice.

## Release verification

Before distribution, verify all four roles with authenticated accounts; create a ticket; assign it; complete it with proof media and notes; confirm that invalid lifecycle transitions are rejected; create a one-time reminder; create a recurring reminder; acknowledge reminders from tenant, technician, and flat-owner portals; test Arabic RTL mode; and validate mobile layouts.

## Operations and recovery

Review production logs after the first scheduled callback and after the first notification batch. If a provider is unavailable, the application should retain the reminder state and surface the failure through logs rather than exposing credentials in the dashboard. Keep database backups enabled, rotate provider secrets when staff access changes, and maintain an organization owner recovery path.

Publishing is completed by the project owner through the project’s **Publish** action after reviewing the latest checkpoint. This workspace does not publish automatically.
