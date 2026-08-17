# Maintainr Demo: Supabase PostgreSQL + Netlify

Yes, Supabase is suitable for the demo because it provides PostgreSQL. Maintainr uses PostgreSQL directly through `DATABASE_URL`; it does not use Supabase Auth or the Supabase JavaScript client. Keep the database connection string server-side.

## 1. Create the Supabase database

Create a project at [supabase.com](https://supabase.com/). Choose a strong database password and save it in a password manager. In the Supabase dashboard, open **Connect** and copy the **Transaction pooler** connection string for serverless traffic. It normally uses port `6543`. Replace the password placeholder with your database password and set the complete value as Netlify’s `DATABASE_URL`. Supabase recommends transaction pooling for serverless or edge functions; direct connections are better for migrations and long-lived servers.[1]

For a one-time schema import, open Supabase **SQL Editor**, paste the complete contents of `POSTGRESQL_SCHEMA.sql`, and run it. Then confirm that the tables include `organizations`, `users`, `sessions`, `passwordResetTokens`, `roleApplications`, `accountInvitations`, `maintenanceReminders`, and the remaining application tables. Do not paste the database password into SQL or commit it to Git.

## 2. Create the Netlify demo site

Create an account at [netlify.com](https://www.netlify.com/), choose **Add new project**, connect the Git repository, and let Netlify read the repository’s `netlify.toml`. The repository already specifies the build command `pnpm build:netlify`, the publish directory `dist/public`, and the Functions directory `netlify/functions`.

In Netlify, open **Project configuration → Environment variables** and add the variables below. Netlify supports managing variables through the UI, CLI, API, or configuration, but secrets should be entered in the UI or CLI rather than committed to the repository.[2]

## 3. Where each variable comes from

| Variable | What to enter | Where to get it |
|---|---|---|
| `DATABASE_URL` | Supabase transaction-pooler PostgreSQL URL on port `6543` | Supabase dashboard → **Connect** → **Transaction pooler**; URL-encode special password characters if necessary |
| `BOOTSTRAP_MANAGER_EMAIL` | Your own email address | Choose the email you will use for the first Manager account |
| `AUTH_BASE_URL` | The final HTTPS Netlify URL, such as `https://maintainr-demo.netlify.app` | Netlify site overview after the first site is created; update it if the domain changes |
| `RESEND_API_KEY` | A restricted send-only key beginning with `re_` | Resend dashboard → API Keys → create a sending key |
| `NOTIFICATION_FROM_EMAIL` | A sender such as `Maintainr <notifications@your-verified-domain.com>` | Use an address on a domain verified in Resend; for a quick demo, use the sender address allowed by your Resend account |
| `S3_BUCKET` | Bucket name | Your chosen S3-compatible provider |
| `S3_REGION` | Provider region, commonly `us-east-1` | Your storage provider’s bucket settings |
| `S3_ACCESS_KEY_ID` | Storage access key | Your storage provider’s access-key page |
| `S3_SECRET_ACCESS_KEY` | Storage secret | Your storage provider’s access-key page; never share it in chat |
| `S3_ENDPOINT` | Provider endpoint, if not AWS S3 | Leave empty for AWS S3; use the provider’s documented endpoint for Cloudflare R2, Wasabi, or another compatible service |
| `S3_PUBLIC_BASE_URL` | Optional public base URL | Leave empty for private buckets; Maintainr will use signed URLs |
| `REMINDER_CALLBACK_SECRET` | A new random long secret | Generate locally with `openssl rand -hex 32`; enter the same value only in Netlify, never in frontend code |

The optional `TWILIO_*` variables can remain unset and `TWILIO_ENABLED=false` for the demo. The optional licensing variables can remain empty because purchase-code activation is deferred for private use.

## 4. First login

Deploy the site after saving the variables. Open the deployed Netlify URL and choose **Sign up**. Use the exact email configured as `BOOTSTRAP_MANAGER_EMAIL`; the first matching account is assigned the Manager role. Tenants and Technicians should use `/apply` to enter their own email, their requested role, and the Property Manager’s email. The application is stored in the Manager dashboard. When Resend is configured, Maintainr emails both the Property Manager and applicant that the application was received. The Manager reviews applications, approves the request, selects a unit for a Tenant when applicable, and Maintainr sends the applicant a bilingual single-use invitation. The applicant creates their own password at `/invitation?token=...`; never share or email the Manager’s password.

Open `/api/health` to confirm the Function responds. Open `/api/health/database` to confirm the Supabase connection and schema. If the database check fails, copy only the status and non-secret error text; never share `DATABASE_URL` publicly. Test `/forgot-password` only after adding Resend variables and verifying the sender domain.

## 5. Demo limitations

Netlify Scheduled Functions run only on a published deploy, use UTC, and cannot be invoked directly by a normal public URL. Netlify’s Functions page provides **Run now** for manual testing. The current reminder Function runs every fifteen minutes and processes due reminders from PostgreSQL. Netlify documents a thirty-second limit for Scheduled Functions, so keep each reminder run bounded.[3]

For a demo, use a small test bucket and a non-production Supabase project. Before real customer use, enable backups, restrict S3 permissions, verify email sending, configure a custom domain, rotate all demo secrets, and create a separate production database.

## References

[1]: https://supabase.com/docs/guides/database/connecting-to-postgres "Supabase: Connect to your database"
[2]: https://docs.netlify.com/build/configure-builds/environment-variables/ "Netlify: Build environment variables"
[3]: https://docs.netlify.com/build/functions/scheduled-functions/ "Netlify: Scheduled Functions"
[4]: https://resend.com/docs/introduction "Resend: Introduction"
