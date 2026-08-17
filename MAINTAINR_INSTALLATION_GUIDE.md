# Maintainr Installation and Professional Publishing Guide

**Version:** August 2026  
**Audience:** Maintainr project owner, developer, or deployment administrator  
**Purpose:** Configure, test, and publish Maintainr as a professional multi-tenant property-maintenance SaaS.

> **Recommended architecture:** Keep Maintainr’s current managed MySQL/TiDB database, Manus OAuth, S3-compatible media storage, and scheduled reminder callback. Firebase is optional and is not required to publish the current product.

## 1. What you must create

For the first professional release, create the accounts in the following table. You do not need every optional account on day one.

| Account or service | Required? | What it provides | Where to create it |
|---|---:|---|---|
| Maintainr/Manus project | Yes | Hosting, database, OAuth, storage, project settings, publishing | Use the project Management UI |
| Domain registrar/DNS provider | Recommended | Professional website address such as `app.example.com` | Any domain provider you trust |
| Resend | Recommended for email | Ticket, assignment, status, and maintenance-reminder email | [resend.com/signup](https://resend.com/signup) |
| Twilio | Optional | SMS reminders and SMS ticket notifications | [twilio.com/try-twilio](https://www.twilio.com/try-twilio) |
| Firebase | Optional only | Alternative Authentication, Firestore, and Storage setup for a future migration | [console.firebase.google.com](https://console.firebase.google.com/) |

**Do not create Firebase merely to test the existing project.** Maintainr already has a working database, authentication, and storage path. Adding Firebase now would create a second backend and increase operational complexity.

## 2. Configure the Maintainr project

Open the Maintainr project Management UI. In **Settings → General**, configure the website name, visibility, domain, and favicon as available. In the developer settings inside the application, configure the organization’s project name, Arabic project name, logo URL, primary color, accent color, and notification channel toggles.

Use the exact roles already implemented in the application: `PROPERTY_MANAGER`, `TENANT`, `TECHNICIAN`, and `FLAT_OWNER`. The manager portal is `/manager`, the tenant portal is `/tenant`, the technician portal is `/technician`, and the flat-owner portal is `/owner`. After authentication, Maintainr routes the user to the portal matching the stored role.

Create a first test organization with at least one property and several units. Create or invite one account for each role. Generate six-digit unit access codes from the manager portal and verify that a tenant can use `/join-unit` to bind to the correct unit.

## 3. Email setup with Resend

Resend requires an account, a verified sending domain, and an API key before application email can be sent.[1] Create an account at [resend.com/signup](https://resend.com/signup), then open the Resend dashboard.

### 3.1 Verify your sending domain

In Resend, open **Domains**, choose **Add Domain**, and enter a domain that you own, such as `example.com` or `mail.example.com`. Resend will display DNS records. Open your domain registrar’s DNS manager and add the records exactly as Resend shows them. Return to Resend and wait for the domain to become verified. Use an address such as `notifications@example.com` as the sender after verification.[2]

### 3.2 Create the API key

In Resend, open **API Keys**, choose **Create API Key**, give it a name such as `maintainr-production`, select the minimum permission required for sending, and copy the key immediately. Resend API keys are secret tokens used to authenticate API requests.[3]

### 3.3 Add the email values to Maintainr

Use the project’s managed **Settings → Secrets** area or the secure secret-entry card. Add the following values. Never paste these into React code, never commit them to Git, and never put them into the Developer Settings form.

| Environment variable | Value to enter | Required |
|---|---|---:|
| `RESEND_API_KEY` | The Resend API key beginning with the provider’s key prefix | Yes for email delivery |
| `NOTIFICATION_FROM_EMAIL` | The verified sender, for example `notifications@example.com` | Yes for email delivery |

Keep the application’s email channel disabled until both values are configured and a test email has arrived successfully. Then enable email from the Developer Settings screen.

## 4. Optional SMS setup with Twilio

Twilio SMS is optional. Email should be enabled and tested first. Twilio’s SMS quickstart requires a Twilio account, an SMS-capable number, and the account credentials used to authenticate API requests.[4]

Create an account at [twilio.com/try-twilio](https://www.twilio.com/try-twilio) and open the Twilio Console. The Console dashboard displays the **Account SID**. It is normally an identifier beginning with `AC`. The **Auth Token** is available in the account security area; treat it as a password and do not share it.[5]

Next, obtain a phone number with SMS capability. In the Twilio Console, use **Phone Numbers → Buy a number** or the equivalent number setup flow, select a number that supports SMS in your target country, and copy the number in international E.164 format. Twilio’s quickstart describes obtaining a number from the Account Dashboard and using it as the sender.[4]

Add these values as managed secrets. Leave `TWILIO_ENABLED=false` until all required values are present and tested.

| Environment variable | Value to enter | Required |
|---|---|---:|
| `TWILIO_ENABLED` | `true` only after configuration and testing; otherwise `false` | Optional |
| `TWILIO_ACCOUNT_SID` | Twilio Console Account SID | Required only for SMS |
| `TWILIO_AUTH_TOKEN` | Twilio Console Auth Token | Required only for SMS |
| `TWILIO_FROM` | SMS-capable Twilio phone number in E.164 format | Required only for SMS |

Trial accounts can have destination restrictions, verification requirements, or account limitations. Confirm the Twilio Console’s current requirements for the countries where your users live before enabling SMS.

## 5. Firebase optional setup

Firebase is an optional future backend path. The current Maintainr application continues to use the existing backend when Firebase is empty. If you still want to prepare Firebase, use the official Firebase Console and create a project. Firebase’s web setup requires creating a project and registering a web app; registration provides the Firebase configuration object used by the client SDK.[6]

In the Firebase Console, create a project, register a Web App, enable only the services you intend to use, and copy the Web App configuration values. For Authentication, start with the sign-in methods you actually need. For Firestore, create the database in Native mode and write organization-aware security rules before using live data. Firebase Security Rules control access and data validation and must not be left open in production.[7]

Add the following client configuration values only if you are deliberately preparing the optional Firebase path. These are client configuration identifiers, not a replacement for server-side secrets.

| Environment variable | Firebase Web App field |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional Analytics measurement ID |
| `VITE_FIREBASE_ENABLED` | Keep `false` until rules and migration are complete |

Do not upload a Firebase service-account JSON file to the browser, Git repository, or public storage. Do not enable Firebase as a second source of truth without a migration plan for users, organizations, tickets, media, reminders, and audit logs.

## 6. Where environment values belong

Use the project’s secure environment/secrets management interface for real credentials. The repository contains `.env.production.example` and `.env.notifications.example` as reference templates only. They contain blank values and must remain safe to commit.

| Value type | Correct location |
|---|---|
| Resend API key, Twilio Auth Token, database credentials, server OAuth secrets | Managed project secrets |
| Project name, Arabic project name, logo URL, primary color, accent color | Maintainr Developer Settings |
| Email/SMS enabled or disabled | Maintainr Developer Settings, with safe disabled defaults |
| Firebase Web App identifiers | Client environment configuration only if Firebase is deliberately enabled |
| Public domain and favicon | Project Management UI settings |

If you are asked to enter a secret in chat, do not paste it into the conversation. Use the secure secret card or project secret manager instead.

## 7. Test the complete product before publishing

First, test sign-in and sign-up with separate accounts. Confirm that a new user can complete `/join-unit` with a valid six-digit code and that an invalid code is rejected. Confirm that each exact role reaches only its own portal.

Next, use the manager portal to create a ticket, assign a technician, change priority, and review the audit history. Use the tenant portal to create a request with multiple attachments. Use the technician portal to upload proof media and resolution notes; verify that resolution cannot be submitted without both. Use the owner portal to review the scoped reminder and ticket information.

Create one one-time reminder and one recurring reminder. Confirm that the manager can see and edit them, that tenants/technicians/owners see only their scoped reminders, and that acknowledgement state is visible. Keep email and SMS disabled for the first local test, then enable email and send one production test. Enable SMS only after its provider test succeeds.

Switch to Arabic and verify the public pages, authentication, onboarding, manager dashboard, reminder form, reminder inbox, ticket forms, and mobile layouts. Verify that the URL query preview `?lang=ar` does not change the user’s persisted language preference.

## 8. Publish and distribute

Before publishing, confirm that all production secrets are configured, the notification sender domain is verified, the domain is connected, the database schema migration has been applied, and the latest tests pass. Create a checkpoint in the project Management UI. Then use the project’s **Publish** button to make the application available. Publishing is a user-controlled action; it should be performed only after the release checklist is complete. Manus documents publishing in its [official Publishing guide][8] and custom-domain connection in its [official Custom Domains guide][9].

After publishing, open the production URL in a private browser window and test sign-in, sign-up, `/join-unit`, each portal URL, media upload, email, reminders, and the language switch. Review production logs after the first scheduled reminder callback. Keep database backups enabled and document who can rotate secrets, recover the organization owner account, and disable notification channels during an incident.

## References

[1]: https://resend.com/docs/introduction "Resend Introduction"
[2]: https://resend.com/docs/add-a-domain "Resend: Add a domain"
[3]: https://resend.com/docs/create-an-api-key "Resend: Create an API key"
[4]: https://www.twilio.com/docs/messaging/quickstart "Twilio SMS developer quickstart"
[5]: https://www.twilio.com/docs/iam/api/authtoken "Twilio REST API: Auth Token"
[6]: https://firebase.google.com/docs/web/setup "Firebase: Add Firebase to your JavaScript project"
[7]: https://firebase.google.com/docs/rules "Firebase Security Rules"
[8]: https://manus.im/docs/website-builder/publishing "Manus: Publishing"
[9]: https://manus.im/docs/website-builder/custom-domains "Manus: Custom Domains"
