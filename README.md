# SAATHI

**The care circle that never lets an elder go unnoticed.**

SAATHI is an autonomy-first elderly care coordination app. Adult Firebase Authentication accounts join private care circles, and an elder pairs a device once with a separate PIN. Caregivers manage a fixed-clock medication schedule; elders can report a routine, snooze for 15 minutes, or ask their care circle for help. A helper can atomically claim an alert and record how it was handled.

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

The browser adapter uses Firebase's supported Identity Toolkit Email/Password sign-up/sign-in endpoints. This is a narrow fit for the current flow: it obtains an ID token only to exchange it immediately for an HttpOnly SAATHI session, then discards both the ID token and Firebase refresh token. Firebase Admin verifies signature, issuer, audience, expiry, and revocation before issuing that session. No SAATHI API receives or stores adult passwords, and Firebase tokens are sent only in an Authorization header, never a URL or log. The session then has its own 12-hour idle and 7-day absolute lifetime; logout or member removal revokes SAATHI sessions. A Firebase account disabled after exchange does not invalidate an already issued SAATHI cookie immediately, so use the short SAATHI session lifetime and app-level revocation for this MVP. Prefer the Firebase Web Auth SDK if the app later needs ongoing Firebase client auth, token refresh, or SDK-only features. The SDK was not installed because npm registry DNS was unavailable, and the lockfile remains unchanged.

This adapter and server code have not been verified against a live Firebase project because no Firebase configuration is present in the environment.

## Current workflows

- `/register` — caregiver registration and circle creation, or Firebase account creation with an invitation code.
- `/login` — adult sign-in and server-side SAATHI session exchange.
- `/setup` — recover/finish caregiver circle setup.
- `/care-circle` and `/caregiver` — member list, invitation codes, elder device pairing, device revocation, permissions, medication management, manual reminder processing, in-app notifications, appointments, alert claiming, and Care Memory for authorized roles.
- `/pair-device` — one-time elder pairing, 4–6 digit PIN, and elder-controlled consent.
- `/elder` — paired Elder Mode without daily login, with today's schedule and the three Care Signal actions.
- `/family` — invitation-based, server-filtered view with authorized schedule, appointments, help alerts, and Care Memory.
- `/demo` — isolated fictional data with caregiver, elder, and family views, local persistence, simulated time, and English/Hindi switching. Demo changes do not call authenticated APIs or modify Firebase.
- `/api/health` — dependency-free health check.

Medication, dose, alert, appointment, notification, and event APIs use the current SAATHI session and derive the circle and role on the server. Dose occurrences use deterministic IDs and the circle's timezone. “I’m okay” is a report from the elder, not proof medicine was taken. No response remains unconfirmed. A caregiver can manually check due reminders; there is no background scheduler. Appointments have a chronological agenda, optional assignment and acknowledgement, and repeat-safe 24-hour/1-hour reminder windows. Help alerts appear in the app, but there is no SMS, push, email, or emergency dispatch. The language switcher offers English and Hindi on the main care screens.

All private operations re-read the session’s member and current permissions from Firestore. Member, invite, pairing, permission, consent, device, and session-revocation events are recorded as Care Memory entries.

## Checks

```sh
npm run lint
npm run typecheck
npm run test
npm run build
```

Tests use Node’s built-in test runner and exercise auth primitives, permission rules, schedule timezone conversion, date limits, dose display state, and isolated demo workflows without Firebase credentials. They do not substitute for Firestore transaction tests or live Firebase sign-in.

## Deploy

Import the GitHub repository into Vercel, keep the standard Next.js build, and set the public Firebase web settings plus private Admin credentials, PIN/pairing peppers, and `APP_BASE_URL` in encrypted environment variables. Stay on Vercel Hobby and Firebase Spark; do not connect a billing account or use Cloud Run, Docker, Cloud Scheduler, Secret Manager, or a paid email provider.

Publish [`firestore.rules`](firestore.rules) in the Firebase Console before use. Review [`firestore.indexes.json`](firestore.indexes.json) and deploy its indexes for member, session, dose, alert, and Care Memory queries. See [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) for the full setup steps.

## Preserved prototype

The original Carewell static prototype and README remain in [`legacy-prototype/`](legacy-prototype/) as a visual reference only. Its local-storage data is not connected to SAATHI.
