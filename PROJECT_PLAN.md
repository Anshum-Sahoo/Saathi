# SAATHI project plan

**Promise:** The care circle that never lets an elder go unnoticed.

**Hard constraint:** zero payment and no Google Cloud billing account. Deploy the Next.js application to Vercel Hobby; use Firebase Firestore Spark; use Gemini only within eligible free quota. Do not use Cloud Run, Docker, Cloud Build, Artifact Registry, or paid Google Cloud services.

## Current foundation

- The original Carewell static prototype and its README are preserved in `legacy-prototype/` as a visual reference.
- The root Next.js App Router app has the `/`, `/elder`, `/caregiver`, `/family`, and `/api/health` routes, plus a lazy server-only Firebase Admin accessor.
- These pages are preview shells: sample content is fictional, Care Signal actions are disabled, and authentication, Firestore workflows, medication CRUD, escalation, and Gemini are not implemented.
- Node 24/npm 11 are available. No `.git` directory, remote, cloud project, Firebase project config, or service credentials were present in the workspace at audit time. GitHub remote status must be verified separately.

## Final seven-hour scope

### P0 — core shared-care journey

1. One-time elder device pairing and role-scoped caregiver/family access.
2. Medication CRUD that preserves prior dose history.
3. Care Signals with taken, snoozed, and skipped-with-reason states.
4. Atomic “I've Got It” assignment; show the named owner to the circle.
5. Idempotent due-task escalation logic, with a free-plan-compatible trigger selected only after verifying current Vercel Hobby limits. Do not create a Cloud Scheduler dependency.
6. Care Memory with author/time attribution and care-circle-only access.
7. Vercel Hobby deployment and Firebase Spark Firestore. No paid cloud resources.

### P1 — after P0

- Accessible one-screen Elder Mode, elder-controlled escalation preferences, caregiver activity log, and appointments.

### P2 — after the shared-care path

- Gemini prescription extraction using the official Google Gen AI SDK and only eligible free quota. Output remains an editable draft requiring human confirmation.
- Email behind a small provider interface only when a no-cost credential/provider configuration is available; otherwise in-app status only.

### P3 — defer

- Optional Doctor Visit Brief. Garden, Hindi/voice logging, and expanded change approvals are outside the current build phase.

## Architecture

```text
Browser → Next.js App Router (TypeScript strict, Tailwind) on Vercel Hobby
            ├─ Route Handlers and server-only services
            ├─ Firebase Admin SDK → Firestore Spark
            └─ later: official Google Gen AI SDK, server-side and free-quota-only
```

- Keep APIs in `src/app/api/**/route.ts` and shared server-only logic under `src/lib/`. Firebase Admin is server-only. Never access Firestore directly from browser components.
- Firebase Authentication may provide identity; verify tokens in Route Handlers and resolve circle/role membership from trusted server data on every protected operation.
- Pairing codes must be high-entropy, hashed at rest, short-lived, single-use, and rate-limited. Do not trust roles or elder IDs supplied by the browser.
- Use deterministic dose occurrence IDs and Firestore transactions for claims and escalation state transitions. Retries must not duplicate task stages; claimed or terminal tasks stop escalating.
- Keep medication plans separate from dose history. Care Memory is circle-scoped and attributed. Store timestamps in UTC and render in the elder's timezone.
- Keep secrets server-side. Use Vercel environment settings for server-only credentials; never commit service-account JSON or use `NEXT_PUBLIC_` for secrets. The health endpoint must work without Firebase configuration.
- Use the standard Next.js production build for Vercel; do not enable standalone output or add Docker/Cloud Run files.

## Phase 2 foundation acceptance

- `npm ci` succeeds from the checked-in lockfile.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- `/`, `/elder`, `/caregiver`, and `/family` render responsive, clearly marked preview shells. Elder Signal actions are disabled; the text-size control works.
- `GET /api/health` returns HTTP 200 JSON with `status`, application name, and timestamp, without requiring Firebase credentials or revealing environment details.
- Firebase Admin initialization is lazy, server-only, environment-configured, and returns safely when project configuration is absent.
- README describes local setup and Vercel Hobby deployment; legacy Carewell source and README remain preserved.

## Next build sequence

1. Implement pairing and server-side role authorization; test expiration, reuse, and cross-circle denial.
2. Add Firestore medication plans, dose occurrences, and taken/snoozed/skipped signals.
3. Implement transactional task claims and visible activity.
4. Implement idempotent escalation and verify a Vercel Hobby-compatible trigger within the zero-cost constraint.
5. Add Care Memory, then P1 accessibility, preferences, and appointments.
6. Consider Gemini/email only after core workflows pass and free service limits/credentials are confirmed.

## Commands

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

Deploy by importing the GitHub repository into Vercel and using its default Next.js build settings. Do not run Docker or Google Cloud deployment commands.

## Main risks

1. Pairing misuse or cross-circle access can expose health data; enforce every permission on the server.
2. Claim races can create false ownership; use a Firestore transaction and return a conflict to the losing caregiver.
3. Free-plan background scheduling may not meet escalation timing needs; verify plan limits before promising unattended delivery.
4. Vercel-to-Firebase Admin credentials need secure server-side configuration; health and preview routes must remain usable without them.
5. Gemini extraction is not medical validation; require human review before changing any medicine.
6. Do not introduce usage that requires billing; monitor free quotas and keep optional services disabled when credentials/limits are unknown.
