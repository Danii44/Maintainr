# Firebase Assessment

## Findings from official Firebase documentation

Firebase Authentication provides email/password, phone, and federated sign-in options through the web SDK and FirebaseUI. Firebase Authentication integrates with Firestore Security Rules for user-based and role-based access control. Firebase’s optional Identity Platform upgrade adds managed multi-tenancy, but this is a separate upgrade with additional limits and pricing considerations.

Cloud Firestore Security Rules can enforce access control and data validation for web/mobile client requests. The official documentation warns that server client libraries bypass Firestore Security Rules and instead require IAM, so any server-side admin path must be protected independently. Rules should therefore model organization membership and role checks explicitly.

Cloud Storage for Firebase is suitable for maintenance photos and videos, but the official setup documentation currently requires the Firebase project to be on the pay-as-you-go Blaze plan before creating a default Storage bucket. This means Firebase Storage is not a fully free Spark-plan path for the requested media-upload workflow.

The official pricing page lists no-cost Firestore quotas including 1 GiB stored data, 20,000 document writes per day, 50,000 reads per day, and 20,000 deletes per day on the Spark plan. Authentication has no-cost options, but phone authentication is billed per SMS. Cloud Storage is listed under Blaze with usage-dependent quotas and charges.

## Recommendation

Firebase Firestore plus Firebase Authentication is a reasonable alternative if the user wants a simple managed backend and accepts a document database model. It is especially suitable for the bilingual portal, real-time ticket updates, and straightforward authentication. However, because the project requires photo/video uploads, the free path should either retain the current built-in storage service or accept Firebase Blaze billing for Cloud Storage. The safest recommendation is a gradual migration: use Firebase Authentication and Firestore for a simplified portal only after the user creates a Firebase project and supplies its web configuration; keep storage on the current built-in storage layer until the billing choice is confirmed.

## Sources

[1] Firestore Security Rules: https://firebase.google.com/docs/firestore/security/get-started

[2] Firebase Authentication: https://firebase.google.com/docs/auth

[3] Cloud Storage for Firebase Web Setup: https://firebase.google.com/docs/storage/web/start

[4] Firebase Pricing: https://firebase.google.com/pricing
