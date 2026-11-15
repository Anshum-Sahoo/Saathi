# SAATHI repository instructions

## Source of truth and scope

- `docs/SAATHI_REFERENCE.md` is the detailed product, API, data, security, and behavior specification. `PROJECT_PLAN.md` records the approved scope and current phase.
- The authoritative deployment target is zero-payment: Vercel Hobby, Firebase Spark, eligible Gemini free quota, and GitHub Actions best-effort schedules. No Google Cloud billing account.
- Do not add Cloud Run, Cloud Scheduler, Secret Manager, Docker deployment, Cloud Build, Artifact Registry, FastAPI, a second backend, PostgreSQL, Redis, or paid services.
- Preserve all working Phase 2 foundation and `legacy-prototype/` as a read-only visual reference. Phase 3 authentication and care-circle foundation is implemented. Phase 4 medication management, elder Care Signals, atomic help claiming, and Care Memory are authorized; do not add background escalation, Gemini scanning, email, appointments, or unrelated features in this phase.

## Stack and boundaries

- One Next.js App Router application with strict TypeScript and Tailwind. Use Route Handlers and small server-side services under `src/lib/`; API routes use the Node runtime and are dynamic when they read or mutate user data.
- Firebase Admin SDK is the only Firestore data path and stays server-side. Firestore rules deny client reads and writes. Browser Firebase SDK use, if needed, is for adult Firebase Authentication only; send verified ID tokens to the server and never access Firestore from the browser.
- Caregiver, family, and emergency-contact identity uses Firebase Authentication. Members store the verified Firebase `uid`, not a SAATHI password hash. An elder uses a separate 4–6 digit PIN for step-up and a short-lived, one-time pairing code to establish an elder-device session.
- Resolve circle, role, member, and permissions from verified server-side identity/session data on every protected request. Never trust client-supplied roles, circle IDs, or elder IDs. Pairing and invite codes are single-use, short-lived, hashed, and rate-limited.
- Use Firestore transactions for claims and state transitions, deterministic IDs for idempotency, and append-only circle-scoped Care Memory. Medication changes preserve historical dose snapshots; no response stays unconfirmed. Keep secrets server-side; no secrets in source, `NEXT_PUBLIC_*`, logs, screenshots, or examples.
- Gemini is optional and limited to prescription transcription after core workflows. Treat output as untrusted draft text, validate it, and require human review and human-selected dose times. Never generate medical advice or dosing instructions.
- Escalation is driven by persisted due timestamps and a protected idempotent processor called by GitHub Actions schedule/manual runs, with authorized request-time catch-up. Schedules are best effort; never promise exact-time medical alerts. Email is optional; in-app notifications are required and log mode must not be described as delivered email.

## UI and safety

- Elder Mode uses large readable text, large touch targets, semantic controls, visible keyboard focus, plain English/Hindi, status announcements, and reduced-motion support.
- Use respectful, autonomy-first language. A confirmation means “reported by the elder,” not proof medicine was taken. Never rely on color alone or make adherence guilt-inducing.
- Label preview data and keep unavailable actions disabled. Distinguish in-app status from delivered email.
- Treat health details as sensitive. Use fictional fixtures, minimize collection and retention, return safe errors, and never expose records across circles.

## Repository workflow

- Inspect existing files and callers before editing. Preserve useful work and keep changes small; do not add dependencies without need.
- Keep `README.md`, `PROJECT_PLAN.md`, and the reference consistent with implemented behavior and the approved Vercel/Firebase architecture.
- Keep the npm scripts `dev`, `build`, `start`, `lint`, and `typecheck` accurate. Use `npm ci` from the committed lockfile.
- Expected checks when implementation is authorized: `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build`, plus a local workflow check where dependencies are available. Report only checks actually run.
- Do not claim deployment or external integration until its live behavior is verified. Never force-push or overwrite existing remote content.
