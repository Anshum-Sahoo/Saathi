# SAATHI — Elder-First Care Coordination

**SAATHI connects older adults, family members, and caregivers through medication management, simple care check-ins, shared responsibility, and a common care history.**

> **Project:** CATALYST — Solo AI Hackathon 2026  
> **Problem statement:** Elderly Care & Medication Management Platform  
> **Repository:** [Anshum-Sahoo/Saathi](https://github.com/Anshum-Sahoo/Saathi)  
> **Firebase project:** `saathi-f6a7e`

---

## The problem

Elderly care is not only about remembering medication. It also depends on communication between the older adult, family members, and caregivers. A reminder can be acknowledged without anyone knowing whether help is needed, who is responding, or what happened afterwards.

SAATHI aims to make care coordination more visible and accountable while keeping the older adult involved in decisions about their care.

## What SAATHI does

### Medication management

Caregivers with the appropriate permissions can add, edit, pause, and discontinue medication schedules. The application supports scheduled times, applicable days, date ranges, and the care circle's time zone. Historical dose records are retained when a medication is paused or discontinued.

### Care Signals

The elder-facing experience is designed around three clear actions:

- **I'm okay** — records the elder's self-reported response.
- **Not yet** — snoozes the reminder for 15 minutes.
- **I need help** — creates a help request with a reason such as medicine finished, feeling unwell, or requesting a call.

A self-reported response is not proof that medication was ingested. No response remains **unconfirmed**; it is not automatically treated as a missed dose.

### Shared help alerts — “I've Got It”

Authorized caregivers and family members can view help requests. A member can claim an alert, making the responsible person visible to the rest of the care circle. The claimant can record an outcome and resolve the request. The real Firebase implementation uses a transaction for alert ownership.

### Care Memory

Care Memory provides a shared timeline of relevant actions, including medication changes, reported responses, snoozes, help requests, claims, and resolutions. It is intended to make caregiver handoffs easier.

### Appointments and family coordination

The application includes appointment workflows for creating, editing, cancelling, and completing appointments, assigning a responsible family member, and acknowledging responsibility. Appointment notifications are generated through the reminder-processing flow.

### Notifications and reminders

SAATHI supports persistent in-app notifications and a manual, authorized **Check reminders now** / reminder-processing workflow. Processing is designed to avoid duplicate records and to respect medication schedules and appointment changes.

**Automatic background delivery is not currently guaranteed.** Email, SMS, WhatsApp, and browser push delivery are not claimed as implemented.

### English and Hindi

The interface includes English and Hindi dictionaries and a language preference intended to persist across navigation and refreshes. The application also includes elder-focused layout improvements such as larger text and touch targets.

### Demo mode

The `/demo` experience is an isolated demonstration using fictional, browser-stored data. It supports caregiver, elder, and family views, role switching, simulated time, reminder generation, and help claiming. Demo actions are not real Firebase writes and are not shared across different browsers or devices.

---

## Product principles and safety

- **Elder autonomy:** the elder is a participant in the care circle, not merely an object being monitored.
- **Consent and access control:** access is based on care-circle membership, roles, and permissions.
- **Accountability:** help requests can have a visible owner and recorded outcome.
- **Transparent status:** reported, snoozed, and unconfirmed states are distinct.
- **Privacy:** privileged Firestore operations are performed server-side through Firebase Admin. Firestore client rules are intended to deny direct client reads and writes.
- **No diagnosis:** SAATHI is a care-coordination tool, not a medical device or emergency-response service. It does not diagnose symptoms, prescribe treatment, or determine whether a medication is clinically appropriate. In an emergency, contact local emergency services or a trusted person directly.

## Technology

- **Frontend and application:** Next.js App Router, React, TypeScript, Tailwind CSS
- **Backend:** Next.js Route Handlers
- **Authentication:** Firebase Authentication (Email/Password) with SAATHI server-side sessions
- **Database:** Cloud Firestore
- **Server-side Firebase access:** Firebase Admin SDK
- **Hosting target:** Vercel
- **Tests:** Node.js test runner and the project's existing test suite

The project is designed around Firebase Spark and Vercel Hobby usage. Free-tier limits and provider terms can change; no absolute cost or delivery guarantee is made.

---

## Getting started

### Requirements

- Node.js compatible with the project's `package.json` and lockfile
- npm
- A Firebase project for real authenticated use

### 1. Clone the repository

```bash
git clone https://github.com/Anshum-Sahoo/Saathi.git
cd Saathi
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Create `.env.local` in the project root. Do not commit this file.

```env
# Firebase Web app configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-web-app-id

# Firebase Admin SDK — server-side only
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----\n"

# Independent, high-entropy application secrets
ELDER_PIN_PEPPER=generate-a-unique-random-secret
PAIRING_CODE_PEPPER=generate-a-different-unique-random-secret

# Exact origin used by this local application
APP_BASE_URL=http://localhost:3000
```

Use values from the **same Firebase project** for the Web app and Admin SDK. `FIREBASE_PRIVATE_KEY` must be the `private_key` value from the downloaded service-account JSON, formatted with newline separators as expected by the Admin initializer.

Generate the two peppers independently. For example, run this command twice and use a different output each time:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never place the Admin private key or peppers in `NEXT_PUBLIC_` variables. Never upload a service-account JSON file, `.env.local`, private key, or token to GitHub or share it in issue reports.

### 4. Configure Firebase

In the Firebase Console for your project:

1. Register a Web app and copy its Web configuration into `.env.local`.
2. Enable **Authentication → Email/Password** for adult caregiver/family accounts.
3. Create a **Cloud Firestore** database in Native mode. Choose its location carefully; a Firestore database location cannot be changed after creation.
4. Configure Firebase Admin credentials for the server.
5. Review and deploy the repository's Firestore rules and indexes using the Firebase CLI and the project's Firebase configuration.
6. Add the local host and deployed application domain to Firebase Authentication's authorized domains when required.

Keep Firestore client access locked down. The application is designed for server-side Firestore access through Firebase Admin; do not make collections publicly readable or writable to get the app working.

### 5. Run locally

```bash
npm run dev
```

Open the local URL printed by Next.js (normally `http://localhost:3000`). If you use a different port, set `APP_BASE_URL` to that exact origin and restart the server.

The demo is available at:

```text
/demo
```

The demo uses fictional local data. It is not evidence that Firebase Authentication or Firestore is connected.

---

## Useful commands

```bash
# Run tests
npm run test

# Lint
npm run lint

# TypeScript check
npm run typecheck

# Production build
npm run build

# Run the production build locally (after building)
npm run start
```

## Application areas

| Area | Purpose |
|---|---|
| `/login` | Adult account login |
| `/` | Application landing / entry page |
| `/caregiver` | Caregiver workspace |
| `/elder` | Elder medication and Care Signals experience |
| `/family` | Family view and coordination |
| `/care-circle` | Care-circle setup and member/device management |
| `/pair-device` | Elder device pairing flow |
| `/demo` | Fictional, isolated product demonstration |
| `/api/health` | Application health endpoint |

Route availability and access depend on the current application configuration and authentication state.

---

## Verification status and known limitations

The project has undergone local implementation and stabilization. The latest reported verification in the isolated runtime copy was:

- **27 automated tests passed**.
- ESLint passed.
- TypeScript passed.
- Production build passed.
- `/api/health` returned HTTP 200.
- `/demo` returned HTTP 200 and was reviewed.
- A separate Firebase Admin diagnostic successfully exchanged Google credentials, initialized Firebase Admin Auth and Firestore, and completed a read-only Firestore probe.

The following limitations should be considered before treating the application as production-ready:

- Live after-fix behavior of the Memory, Notifications, and Doses endpoints was not confirmed in the latest reported endpoint investigation.
- Real end-to-end registration, session exchange, Care Circle creation, medication persistence, cross-circle authorization, and alert transactions still require a complete authenticated smoke test against the configured Firebase project.
- Production Vercel environment variables and the deployed production domain must be configured and tested separately.
- Reminder processing is manual/best-effort; continuous background delivery is not guaranteed.
- Email, SMS, WhatsApp, browser push, and automatic multi-level timed escalation are not claimed as implemented.
- Voice-based conversational check-in and AI intent parsing are proposed future work, not part of the verified implementation.
- Demo mode stores fictional state in the browser and does not synchronize with Firebase or other devices.

Do not describe any unverified integration as working. Update this section after completing live Firebase and production deployment tests.

---

## Repository and project

- **GitHub:** [https://github.com/Anshum-Sahoo/Saathi](https://github.com/Anshum-Sahoo/Saathi)
- **Project:** SAATHI — Elder-First Care Coordination
- **Hackathon:** CATALYST 2026 — Solo AI Hackathon, organised by Makers Need More (MnM) with PromptWars

## License

No license has been specified in this repository yet. Unless a license is added, the source remains under the repository owner's default copyright; do not assume it is open source for reuse.
