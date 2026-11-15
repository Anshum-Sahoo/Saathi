# SAATHI repository instructions

## Hard constraints

- Keep the project zero-payment: Vercel Hobby, Firebase Firestore Spark, and only eligible Gemini free quota.
- Do not add Cloud Run, Docker, Cloud Build, Artifact Registry, Cloud Scheduler, FastAPI, a second backend, PostgreSQL, Redis, or client-side Firestore access.
- Follow the phase priorities and acceptance criteria in `PROJECT_PLAN.md`. Do not start authentication, medication CRUD, escalation, or Gemini until explicitly assigned to that phase.
- Preserve `legacy-prototype/` as a read-only visual reference. Its local-storage content is fictional and not production functionality.

## Stack and commands

- Next.js App Router, strict TypeScript, Tailwind CSS, and Next.js Route Handlers for APIs.
- Firebase Admin SDK is server-only. Keep shared server services in small modules under `src/lib/`.
- Keep npm scripts `dev`, `build`, `start`, `lint`, and `typecheck` accurate. Run `npm ci` from the lockfile before handoff.
- Expected checks: `npm run lint`, `npm run typecheck`, and `npm run build`.
- Deploy through Vercel Hobby using the default Next.js build settings; never claim deployment until a deployed URL is verified.

## Privacy, identity, and data

- Treat medication, dose, appointment, caregiver, and Care Memory data as sensitive. Use fictional fixtures only and minimize collection/retention.
- Verify identity and care-circle membership on every protected Route Handler. Never trust client-provided roles or elder IDs.
- Pairing codes must be high-entropy, hashed at rest, short-lived, single-use, and rate-limited. Do not log codes or auth tokens.
- Validate and bound all request inputs. Return safe errors without stack traces or credentials. Keep secrets out of source, browser bundles, logs, screenshots, and examples.
- Use Firestore transactions for task claiming and state transitions. Make scheduled-task processing idempotent and preserve dose history when a plan changes.
- Gemini output is untrusted and provisional; require human confirmation before it affects a medication plan.
- Keep the health endpoint independent of Firebase credentials and free of sensitive environment details.

## UI and accessibility

- Elder Mode uses large readable text, touch targets, semantic controls, visible keyboard focus, plain language, and status announcements.
- Respect reduced motion; never rely on color alone or use guilt-inducing adherence language.
- Label preview data and disable actions until their real workflows exist. Distinguish an in-app status from a delivered email.

## Documentation and workflow

- Inspect existing files and callers before editing. Prefer the smallest complete change and preserve useful prototype work.
- Keep README setup, Vercel deployment steps, environment variable names (names only), and feature status synchronized with code.
- Add focused tests for pairing, authorization, claim races, and escalation idempotency when those workflows are implemented. Report only checks actually run.
