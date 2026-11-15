# Firebase setup for SAATHI

This setup uses Firebase Authentication and Firestore on the Spark plan. It does not require enabling Google Cloud billing. The Admin SDK credential can access private care data, so keep it only in local environment settings or Vercel encrypted variables.

## Create the project

1. Create a Firebase project in the Firebase Console. Do not link a billing account or upgrade from Spark.
2. Choose the Firestore location carefully. Firestore location cannot be changed after creation.
3. In **Authentication → Sign-in method**, enable **Email/Password**.
4. In **Firestore Database**, create a database in **Native mode**. Use production mode.
5. In **Project settings → General → Your apps**, register a Web app and copy its public web configuration.

## Configure client and server credentials

Copy `.env.example` to `.env.local` for local development. The `NEXT_PUBLIC_FIREBASE_*` settings are Firebase Web app configuration used by the browser for Firebase Authentication only. They are public identifiers, not Admin credentials. The browser must never import a Firestore data SDK or read care records directly.

For server-side Firebase Admin access, either use Application Default Credentials locally or set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. In Vercel, add those values as encrypted environment variables. Paste the service account private key with escaped newlines (`\n`) if the dashboard requires a single-line value. Never commit a service-account JSON file or expose these variables with `NEXT_PUBLIC_`.

Set `ELDER_PIN_PEPPER` and `PAIRING_CODE_PEPPER` to independent high-entropy values. They protect PIN hashes and one-time code digests; losing them means existing PINs/codes cannot be verified. `APP_BASE_URL` must match the deployed Vercel origin for CSRF checks.

The browser uses Firebase Authentication’s supported Email/Password Identity Toolkit endpoints for one-time sign-up/sign-in and immediately exchanges the ID token for a SAATHI session. The refresh token is discarded because SAATHI uses its own HttpOnly session afterward. Firebase Admin verifies token signature, issuer, audience, expiry, and revocation at exchange. No password is handled by SAATHI APIs. Keep this narrow adapter unless ongoing Firebase client auth, token refresh, or SDK-only functionality is added; the Web Auth SDK is preferable for those needs.

## Deny browser access to Firestore

The repository includes [`firestore.rules`](../firestore.rules). In **Firestore Database → Rules**, publish:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The Firebase Admin SDK runs only on the server and bypasses these rules. Deploy [`firestore.indexes.json`](../firestore.indexes.json) if using the Firebase CLI; this does not require billing. Indexes must finish building before Care Memory and circle member queries are used in production.

## Vercel

Connect the GitHub repository to Vercel and keep the standard Next.js build settings. Add the public web configuration for Production, Preview, and Development as needed. Add Admin credentials and both peppers only as encrypted server environment variables. `APP_BASE_URL` should be the public site origin. Do not add Cloud Run, Docker, Cloud Scheduler, Secret Manager, or a billing account.

The app returns a configuration error when credentials are absent. No live Firebase integration is claimed until sign-up, session creation, Firestore writes, and paired-device revocation have been tested against the actual Spark project.
