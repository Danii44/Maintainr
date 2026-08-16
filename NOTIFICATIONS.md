# Notification Configuration

Maintainr uses email as the default notification channel. Ticket creation, assignment, status changes, and resolution call the notification service without blocking the underlying ticket mutation when delivery credentials are unavailable.

| Variable | Required | Purpose |
|---|---:|---|
| `RESEND_API_KEY` | For email delivery | API key used to send transactional email through Resend. |
| `NOTIFICATION_FROM_EMAIL` | For email delivery | Verified sender address used for ticket notifications. |
| `TWILIO_ENABLED` | No | Set to `true` only when SMS or WhatsApp delivery is intentionally enabled. |
| `TWILIO_ACCOUNT_SID` | Only when Twilio is enabled | Twilio account identifier. |
| `TWILIO_AUTH_TOKEN` | Only when Twilio is enabled | Twilio authentication token. |
| `TWILIO_FROM` | Only when Twilio is enabled | Verified phone number or WhatsApp sender address. |

When `RESEND_API_KEY` or `NOTIFICATION_FROM_EMAIL` is absent, the application returns a safe fallback result and continues the ticket operation. This permits local development and the email-only free path without fabricated credentials. Twilio remains disabled unless `TWILIO_ENABLED=true` and all three Twilio credentials are present.

## Developer dashboard controls

Property managers can open **Developer settings** from the manager portal to configure the organization project name, logo URL, primary color, accent color, and whether email or SMS reminder delivery is enabled. These switches are stored per organization and default to email enabled and SMS disabled.

Provider credentials are deliberately not stored in the dashboard database or exposed to users. Configure them through the project environment/secrets settings using `.env.notifications.example`: Resend requires `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL`; Twilio requires `TWILIO_ENABLED=true`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM`. Missing credentials safely result in undelivered/fallback notifications rather than a failed ticket or reminder workflow.

## Reminder scheduling

Property managers create one-time, daily, weekly, monthly, or yearly reminders from **Manager → Reminders**. Each reminder is scoped to the organization and filtered for the assigned tenant or technician. Recurring execution uses the deployed scheduled callback at `/api/scheduled/maintenanceReminder`; the site must be deployed before a reminder can execute automatically.

## Role destinations

After authentication, users are routed by the exact role stored in the account: `PROPERTY_MANAGER` goes to `/manager`, `TENANT` to `/tenant`, `TECHNICIAN` to `/technician`, and `FLAT_OWNER` to `/owner`. Each portal keeps its own role guard and only exposes reminder data permitted by organization, unit, or assignment scope.
