# Maintainr Independent Deployment, Database Checks, and Licensing

## Executive decision

Maintainr can be deployed to **Vercel, Netlify, or cPanel**, but the backend must run somewhere that supports Node.js server execution, PostgreSQL connectivity, file storage, and scheduled work. A static-only deployment is not sufficient for the tRPC API, uploads, ticket lifecycle mutations, or recurring reminders.

The safest independent release architecture is a Node.js-capable host plus a managed PostgreSQL database, S3-compatible object storage, an independent authentication provider, Resend for email, optional Twilio for SMS, and a scheduled worker or cron endpoint. The current preview still uses the project platform’s authentication and some platform adapters; those must be replaced before external distribution.

## Platform comparison

| Platform | Suitable role | Where the PostgreSQL password goes | Important limitation |
|---|---|---|---|
| **Vercel** | Frontend and server functions when the backend is adapted to serverless execution | Project Settings → Environment Variables → Production; mark sensitive values and redeploy after changes | Long-running workers and stateful processes need a separate worker/cron service; the current Express server may need an adapter |
| **Netlify** | Frontend and serverless functions when the backend is adapted to Netlify Functions | Site configuration → Environment Variables; use Production scope and mark secret values | The current Express server needs a Netlify-compatible function/server adapter; scheduled work may need a separate service |
| **cPanel** | Full Node.js application when the hosting provider enables Node.js and Application Manager | cPanel → Software → Application Manager → Environment Variables | The host must provide Node.js, Passenger/Application Manager, SSL, outbound database access, and a reliable scheduler |

Official platform references: [Netlify environment variables][1], [Vercel environment variables][2], and [cPanel Application Manager][3].

## Where to put the database password

Never put the PostgreSQL password in React code, a `VITE_` variable, `client/public`, Git, screenshots, or the browser. The complete connection string belongs in the **server-side environment variable `DATABASE_URL`**.

```text
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME?sslmode=require
```

On Vercel, add it to the project’s Production environment variables. On Netlify, add it to the site’s Production environment variables with secret handling enabled. On cPanel, add it to the Node.js Application Manager environment-variable table. After changing it on Vercel or Netlify, create a new deployment because environment-variable changes do not retroactively change an existing deployment.[1] [2]

For a professional database account, use a dedicated application database user with only the required schema permissions, SSL, automated backups, and a separate administrator account. Do not use the database owner password in the application if the provider supports a least-privilege user.

## SQL installation

1. Create an empty PostgreSQL database.
2. Upload `POSTGRESQL_SCHEMA.sql` to your computer or provider SQL console.
3. Run the following command from a trusted terminal:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f POSTGRESQL_SCHEMA.sql
```

4. Verify that the eleven Maintainr tables exist: `organizations`, `properties`, `units`, `users`, `tickets`, `ticketMedia`, `ticketLogs`, `maintenanceReminders`, `reminderRuns`, `reminderAcknowledgements`, and `developerSettings`.
5. Configure the same `DATABASE_URL` in the server environment of the deployed application.

The project exposes two diagnostics. `GET /api/health` confirms that the server process is responding. `GET /api/health/database` checks whether the server can connect to PostgreSQL and reach the `organizations` table. It returns status, schema reachability, latency, and timestamp, but never returns the connection string, password, SQL error details, or provider credentials.

## Required server environment values

| Variable | Purpose | Client-visible? |
|---|---|---:|
| `DATABASE_URL` | PostgreSQL connection string | No |
| `AUTH_SECRET` | Independent session signing secret | No |
| `AUTH_BASE_URL` | Public URL for the independent authentication adapter | No |
| `RESEND_API_KEY` | Email delivery | No |
| `NOTIFICATION_FROM_EMAIL` | Verified email sender | No |
| `TWILIO_ACCOUNT_SID` | Optional SMS account | No |
| `TWILIO_AUTH_TOKEN` | Optional SMS credential | No |
| `TWILIO_FROM` | Optional SMS sender | No |
| `REMINDER_CALLBACK_SECRET` | Authentication for the scheduled worker callback | No |
| `LICENSE_SERVER_URL` | Optional private license-validation service | No |
| `LICENSE_PRODUCT_ID` | Optional product identifier | No |
| `LICENSE_KEY` | Optional deployment activation key | No |

The email and SMS channels remain disabled until their provider values are configured and explicitly enabled in Developer Settings.

## Private owner-controlled mode

For the current private deployment, leave `LICENSE_SERVER_URL`, `LICENSE_PRODUCT_ID`, and `LICENSE_KEY` empty or unset. The installation can be restricted through server-side secrets, private deployment access, PostgreSQL credentials, HTTPS, role-based authorization, and controlled administrator accounts. No customer purchase-code screen is required for this mode. Keep these variables reserved for the later distributable edition, when a separate license service and activation policy are ready.

## Envato-style licensing: what is possible

A distributed JavaScript application cannot be made impossible to copy. Anything sent to a customer’s server or browser can eventually be inspected. Licensing can, however, control **activation, updates, support, and server-side access**.

The recommended model is a private license service. Each customer receives a license key containing or referencing a product identifier, purchase/order ID, domain, activation limit, expiration policy, and support/update entitlement. The customer stores `LICENSE_KEY` only on the server. The Maintainr server sends a signed HTTPS request from the server to `LICENSE_SERVER_URL`; the browser never receives the key. The license service returns a short-lived signed activation assertion. Maintainr caches that assertion for a limited offline grace period and blocks protected administration or scheduled execution when the license is invalid or expired.

Do not implement license validation only in React. Do not place a master license secret in the frontend. Do not rely on a client-side domain check as the security boundary. If you do not operate a private license service, use a simpler honest model: sell a license, provide updates/support only to licensed customers, and protect secrets and server features through the deployment environment.

## Independent authentication boundary

The current preview redirects to the installed Manus OAuth adapter. Before distributing outside the project platform, replace that adapter with your selected provider or a self-hosted email/password session system. Preserve the exact roles `PROPERTY_MANAGER`, `TENANT`, `TECHNICIAN`, and `FLAT_OWNER`; preserve organization and unit scoping; and keep password hashing, reset tokens, sessions, and rate limiting on the server.

## Release checks

Before giving the project to a customer, import the SQL into a disposable PostgreSQL database, configure a test `DATABASE_URL`, verify both health endpoints, create a manager and tenant, bind a six-digit unit code, create and complete a ticket with proof media, create and acknowledge a reminder, test Arabic and English routes, and confirm that no browser network response contains `DATABASE_URL`, provider tokens, or `LICENSE_KEY`.

## References

[1]: https://docs.netlify.com/build/environment-variables/ "Netlify environment variables overview"
[2]: https://vercel.com/docs/environment-variables "Vercel environment variables"
[3]: https://docs.cpanel.net/cpanel/software/application-manager/ "cPanel Application Manager"
