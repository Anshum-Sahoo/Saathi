# SAATHI project plan

**Promise:** The care circle that never lets an elder go unnoticed.

**Product:** An autonomy-first shared-care platform where an elder can signal what they need, and a caregiver can explicitly take responsibility. A reminder is a report, never proof medicine was taken.

**Detailed specification:** [`docs/SAATHI_REFERENCE.md`](docs/SAATHI_REFERENCE.md). It is authoritative for product behavior, schemas, APIs, security, accessibility, and acceptance tests. This plan records the approved architecture, current foundation, and build order. Authentication is the explicit project override to the original reference: adult members use Firebase Authentication; elders use a separate PIN and one-time device pairing code.

## Non-negotiable architecture

- Zero-payment target and no Google Cloud billing account: Next.js App Router + strict TypeScript + Tailwind on Vercel Hobby; Firebase Firestore Spark; Gemini only within eligible free quota. GitHub Actions may run CI; no reminder scheduler is configured.
- One Next.js application. Next.js Route Handlers and server-side services are the API. Firebase Admin SDK is the only Firestore access path; deny all browser Firestore reads and writes. No second backend.
- No Cloud Run, Cloud Scheduler, Secret Manager, Docker deployment, Cloud Build, Artifact Registry, FastAPI, PostgreSQL, Redis, or paid service.
- Persist due timestamps and process them with an authenticated, idempotent `/api/reminders/process` endpoint. For this sprint, processing is caregiver-triggered; no scheduled runner is configured. Never promise exact-time medical alerts.
- Keep the existing standard Vercel Next.js build. Do not add standalone output or container deployment configuration.

### Identity and session contract

- Caregiver, family, and emergency-contact accounts authenticate with Firebase Authentication. Firebase owns adult credentials; a member stores the verified `firebaseUid`, not a SAATHI password/passcode hash.
- The browser may use Firebase Authentication to obtain an ID token, but never Firestore. A server Route Handler verifies the token with Firebase Admin, resolves the member and circle from server data, and issues an HttpOnly SAATHI session cookie. The client cannot choose its role or circle.
- A one-time short-lived pairing code creates an elder-device session. The elder sets a separate 4–6 digit PIN during consent; the PIN is securely hashed and is used for step-up approval, not routine pairing or adult sign-in.
- `POST /api/circles` requires a verified Firebase identity and creates the initial caregiver with the circle in `pending_consent`. `POST /api/invites/accept` requires a verified Firebase identity; the stored one-time invite determines role, tier, and permissions. Elder consent is never accepted on the elder's behalf.
- Other API/data contracts follow the reference's sections 2–5, including explicit DTOs, session-derived scope, transaction-based state changes, and no secrets in responses or logs.

## Current implementation: Phase 3 foundation, Phase 4 care workflow, and final feature sprint

- The original Carewell prototype remains in `legacy-prototype/` as a visual reference. Existing Phase 2 Next.js routes and the dependency-free `/api/health` route remain.
- Phase 3 adds Firebase Authentication token exchange, server-created caregiver circles, elder consent and PIN setup, one-time family invites, one-time elder device pairing, server-side sessions, scoped member/device/permission APIs, and the Care Circle/Elder/Family screens.
- Server-side Firestore access uses Firebase Admin only; `firestore.rules` denies browser access. Phase 4 adds role-scoped medication records, deterministic per-day doses in the circle timezone, elder self-reported Care Signals and persistent 15-minute snooze, in-app help alerts, transaction-based claiming/resolution, and Care Memory events.
- The final feature sprint adds caregiver-triggered repeat-safe dose and appointment reminder processing, member-scoped in-app notifications, appointment CRUD/assignment/acknowledgement, English/Hindi switching across major care screens, accessible elder text sizing, and an isolated localStorage demo with simulated time. The demo never calls authenticated APIs or Firebase.
- Adult browser sign-in uses Firebase's supported Identity Toolkit Email/Password endpoints for a one-time ID-token exchange. The adapter discards the Firebase refresh token; use the Firebase Web Auth SDK only if the product needs ongoing Firebase client auth, refresh, or SDK-only features. The design and its limits are documented in `README.md`.
- Firebase credentials, project configuration, and live Firestore/Auth have not been supplied or verified. Setup is documented in `docs/FIREBASE_SETUP.md`; local workflow behavior against a live project remains unverified.
- Scheduled/background delivery, Gemini prescription scanning, email/SMS/push, and Doctor Visit Brief remain deferred. Live Firestore/Auth behavior and Vercel deployment remain unverified.

## MVP scope and order

The reference's 7-hour target is the end-to-end shared-care journey, with the seven-hour plan kept feasible through its cut order. Implement and deploy the core first.

### P0 — must work end to end

1. Vercel deployment and `/api/health` smoke check.
2. Circle creation, elder consent, Firebase Auth adult members, one-time pairing, elder PIN step-up, server-enforced role and permission scope.
3. Medication management, deterministic dose materialization, elder Care Signals (`I'm okay`, `Not yet`, `I need help`), and recorded reasons/states.
4. Caregiver-triggered, idempotent reminder processing, in-app alerting, and atomic “I've got it” claim/release/resolve.
5. Circle-scoped Care Memory with attribution and elder-visible change history.
6. Elder Mode accessibility, English/Hindi across major screens, and elder-controlled consent, permissions, privacy, and timing preferences.

### P1 — after the shared-care journey

- Human-reviewed Gemini prescription transcription; never auto-save or infer dose times.
- Deterministic handoff summary from stored events, not AI.

### P2 — only if time remains

- Calendar `.ics` export and invite emails. In-app notifications remain the only delivery channel in this build.

### Explicitly deferred

- Doctor Visit Brief; voice logging; Garden of Health; and other features absent from the detailed reference. Do not pull these into the MVP without a separate scope decision.
- Never cut the core Care Signal → named caregiver claim path. Scheduled delivery is intentionally omitted; manual reminder checks and the demo sandbox cover the current demonstration.

## Engineering and UX conventions

- Keep domain transitions pure and persistence/notifications in small server modules. Route handlers validate input, authenticate/authorize, call shared services, and return explicit DTOs.
- Use UTC timestamps in storage and the circle's IANA timezone for schedules and display. Use deterministic document IDs and Firestore transactions where retries or concurrent actions could duplicate or lose work. Re-check `expiresAt` in code; Firestore TTL cleanup is not timely enough for security.
- Adult account credentials come from Firebase Auth. Elder PIN hashing, pairing-code hashing, cookie/session handling, lockouts, CSRF/origin checks, rate limits, and cross-circle 404 behavior follow the reference.
- Gemini sees prescription images only in memory, is bounded by size/time/quota, and returns validated candidate text for human approval. Keep a manual-entry fallback.
- The elder UI uses large type/targets, semantic controls, visible focus, status announcements, high contrast, respectful language, and reduced-motion support. Confirmation is explicitly elder-reported, not verified ingestion.
- Email content contains no medicine name, strength, help reason, or private notes. Log mode is not delivery. Do not place real health data or credentials in demo fixtures.

## Build sequence

1. **Phase 3 (implemented, verification incomplete):** adult Firebase Auth identity mapping, sessions, circle creation/consent, invites, elder PIN and pairing, authorization, and Care Memory.
2. **Phase 4 (implemented):** medication plans, deterministic doses, Elder Mode Care Signals, help alerts, atomic claim/resolve, and Care Memory.
3. **Final feature sprint (implemented locally, verification incomplete):** manual reminders, notifications, appointments, English/Hindi, accessibility, and isolated demo mode.
4. Verify checks and the complete flow against Firebase Spark when credentials are supplied; confirm the standard Vercel build and deployment.

## Foundation commands

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

Keep the lockfile committed and scripts accurate. Use Vercel's standard Next.js install/build settings. Vercel server secrets belong in encrypted environment variables; GitHub Actions secrets hold only values needed by workflows. `.env.example` lists names/placeholders only. Never expose secrets with `NEXT_PUBLIC_`.

## Acceptance criteria

- Phase 3: Auth ID tokens are verified with Firebase Admin; role/circle scope comes only from server data; invite/pairing codes are one-time, short-lived, hashed, and rate-limited; elder PIN is separately salted/peppered and used for step-up; cross-circle access is denied; no browser Firestore access; `/api/health` works without Firebase.
- Current local pure unit tests cover auth policy, schedule/timezone rules, and simulated demo workflows. Full lint, typecheck, production build, `npm ci`, live Firestore/Auth integration, Firestore concurrency behavior, and Vercel deployment still need successful verification before release.
- Full MVP acceptance: P0 shared-care journey works against Firestore Spark and Vercel Hobby; elder controls consent; duplicate jobs do not duplicate events/notifications; concurrent claims yield one owner; in-app escalation is available without email or scheduled job delivery. Do not claim completion based on mock UI or preview data.

## Main risks and open decisions

1. Reminder processing is manual in this build; it will not deliver a notification unless an authorized caregiver runs the check. Do not promise real-time reminders.
2. Firebase Admin credentials and Spark project setup must work in Vercel without enabling billing. Choose the Firestore location carefully; it is permanent.
3. Firebase Auth Email/Password and Firestore setup remain unverified without a configured project. Firebase account disablement after token exchange does not immediately invalidate an existing SAATHI session; logout/member removal does, and sessions expire after 12 hours idle or 7 days absolute.
4. A genuinely no-cost email provider/credential path is not yet selected. Until configured and tested, only in-app alerts are promised.
5. Free Firebase/Gemini quotas and current platform limits must be checked at setup. Stop optional integrations rather than incur charges.
6. Garden of Health and voice logging were in earlier product ideas but are absent from the detailed reference and remain deferred. Appointment and scan scope are P1 in the reference and may be cut if P0 is at risk.
