# Firebase Setup for Maintainr

Firebase is prepared as an optional backend configuration. You can add your Firebase project values later without changing the portal UI. The current Maintainr backend continues to work when the Firebase variables are empty.

## 1. Create a Firebase project

Open the [Firebase Console](https://console.firebase.google.com/), create a project, and register a Web App. Copy the Web App configuration values into the environment variables listed below. Do not commit real credentials or private service-account JSON files to this repository.

## 2. Enable services

Enable Firebase Authentication and choose the sign-in methods you want to support, starting with Email/Password and optionally Google. Create a Cloud Firestore database in Native mode. Add organization-aware security rules before using live data. The project’s multi-tenant model should keep `organizationId` on every organization-owned document and restrict reads and writes to authenticated users who belong to that organization.

Firebase Storage is optional for ticket photos and videos. Firebase’s current setup requires the project to use the Blaze pay-as-you-go plan for Cloud Storage, so keep the existing built-in storage path if you want to avoid billing during the initial launch. See the Firebase assessment in `FIREBASE_ASSESSMENT.md` for the tradeoff.

## 3. Add client configuration

Copy `.env.firebase.example` to your local environment file, then replace the empty values with the Web App configuration from Firebase. The values are client configuration identifiers, not private service-account secrets. Use the project’s secure secret manager for any server-side credentials.

| Variable | Firebase value |
|---|---|
| `VITE_FIREBASE_API_KEY` | Web App `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Web App `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Web App `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Web App `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Web App `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | Web App `appId` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional Analytics measurement ID |
| `VITE_FIREBASE_ENABLED` | Set to `true` only after the project is configured |

## 4. Keep the app safe before configuration

Leave `VITE_FIREBASE_ENABLED=false` until Authentication and Firestore rules are configured. Empty Firebase values must not block the current app from starting. Never use open Firestore or Storage rules in production. Test organization isolation, role checks, unit-code binding, and ticket media access with authenticated test accounts before switching the feature flag on.

## 5. Recommended initial role setup

Create one test user for each exact role: `PROPERTY_MANAGER`, `TENANT`, `TECHNICIAN`, and `FLAT_OWNER`. Put the user role and `organizationId` in the user profile document. Keep unit membership in the user profile or a dedicated membership document. The `/join-unit` workflow should validate a six-digit access code on the server before binding a tenant to a unit.

## 6. Deploying rules

Store Firestore and Storage rules in version control and deploy them through the Firebase CLI or Firebase Console. Rules must deny access by default, then grant only the organization and role operations required by each portal. Do not grant global read/write access.

## 7. Current behavior without Firebase

If Firebase is not configured, Maintainr continues using the existing project database, authentication session, and built-in storage integrations. This allows you to review the bilingual interface and complete the initial product setup before adding Firebase values.
