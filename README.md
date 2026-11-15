# SAATHI

**The care circle that never lets an elder go unnoticed.**

SAATHI is an autonomy-first elderly care coordination app. Phase 3 connects adult Firebase Authentication accounts to private care circles, lets families join by one-time invitation, and pairs an elder’s device with a separate PIN. Medication management, Care Signals, escalation, and Gemini are not part of this phase.

## Stack and cost boundary

- Next.js App Router, strict TypeScript, Tailwind CSS, and Route Handlers.
- Firebase Authentication Email/Password and Firebase Admin SDK for server-only Firestore access.
- Firebase Firestore Spark and Vercel Hobby. No Google Cloud billing account is needed or used.
- No browser Firestore access. The included rules deny all client reads and writes.

## Run locally

Requires Node.js 20.9+ and npm.

```sh
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure Firebase using [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) before trying registration, login, circle creation, invites, pairing, or PIN setup. The health route remains independent of Firebase credentials.

## Configuration

`.env.example` lists all required names without credential values:

- Public Firebase web config: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
- Private Firebase Admin config: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Local development may use Application Default Credentials.
- Independent server-only secrets: `ELDER_PIN_PEPPER`, `PAIRING_CODE_PEPPER`.
- `APP_BASE_URL` must match the application origin used for mutating API calls.

Never commit `.env.local`, service-account JSON, PIN hashes, session tokens, or pairing codes. Admin credentials and peppers must never use `NEXT_PUBLIC_` names.

## Authentication implementation note

The intended browser integration is the Firebase Web Authentication SDK. Package installation was blocked in the development environment because `registry.npmjs.org` could not be resolved. To keep the lockfile unchanged and still use Firebase Authentication Email/Password, the current small browser adapter calls Firebase’s Identity Toolkit sign-up/sign-in endpoints and sends the returned ID token to the server. Firebase Admin verifies the ID token before SAATHI issues its own HttpOnly session. No SAATHI API receives or stores adult passwords. Replace the adapter with the Firebase Web Auth SDK once npm registry access is available.

This adapter and server code have not been verified against a live Firebase project because no Firebase configuration is present in the environment.

## Phase 3 workflows

- `/register` — caregiver registration and circle creation, or Firebase account creation with an invitation code.
- `/login` — adult sign-in and server-side SAATHI session exchange.
- `/setup` — recover/finish caregiver circle setup.
- `/care-circle` and `/caregiver` — member list, invitation codes, elder device pairing, device revocation, permissions, and Care Memory for authorized roles.
- `/pair-device` — one-time elder pairing, 4–6 digit PIN, and elder-controlled consent.
- `/elder` — paired Elder Mode without daily login.
- `/family` — invitation-based, server-filtered family view.
- `/api/health` — dependency-free health check.

All private operations re-read the session’s member and current permissions from Firestore. Member, invite, pairing, permission, consent, device, and session-revocation events are recorded as Care Memory entries.

## Checks

```sh
npm run lint
npm run typecheck
npm run test
npm run build
```

Tests use Node’s built-in test runner and exercise auth primitives and permission rules without Firebase credentials. They do not substitute for Firestore integration tests or live Firebase sign-in.

## Deploy

Import the GitHub repository into Vercel, keep the standard Next.js build, and set the public Firebase web settings plus private Admin credentials, PIN/pairing peppers, and `APP_BASE_URL` in encrypted environment variables. Stay on Vercel Hobby and Firebase Spark; do not connect a billing account or use Cloud Run, Docker, Cloud Scheduler, Secret Manager, or a paid email provider.

Publish [`firestore.rules`](firestore.rules) in the Firebase Console before use. Review [`firestore.indexes.json`](firestore.indexes.json) and deploy its indexes for member and Care Memory queries. See [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) for the full setup steps.

## Preserved prototype

The original Carewell static prototype and README remain in [`legacy-prototype/`](legacy-prototype/) as a visual reference only. Its local-storage data is not connected to SAATHI.
