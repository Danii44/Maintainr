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
