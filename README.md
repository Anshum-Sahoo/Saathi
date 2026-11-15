# SAATHI

**The care circle that never lets an elder go unnoticed.**

SAATHI helps older adults, family members, and caregivers coordinate everyday care. Instead of treating a reminder as proof or leaving a help request unanswered, it gives the elder clear choices and makes responsibility visible to the care circle.

## The problem

Medication routines can be missed, while care information is scattered across calls and messages. A reminder alone does not tell a family whether an older adult needs more time, wants help, or has someone responding. SAATHI brings those moments into one shared, permission-aware space.

## How it works

- **Elder:** uses a paired device and a simple, accessible daily routine screen. They can report “I'm okay,” ask for 15 more minutes, or request help.
- **Caregiver:** creates a care circle, manages permitted medication schedules and appointments, and checks due reminders manually.
- **Family:** joins by invitation, sees information allowed by the elder's sharing permissions, and can coordinate around visible care requests.

### A care journey

1. A caregiver creates an account and sets up a care circle.
2. They invite family members or create a one-time code to pair the elder's device.
3. The elder sets a separate PIN and gives consent to sharing. Circle membership and permissions determine what each person can see and change.
4. The caregiver maintains medication routines. The elder reports a response or asks for help from the daily screen.
5. Authorized helpers receive in-app notifications and can claim a help alert. The circle can see who took responsibility and what outcome was recorded.
6. Care Memory keeps a circle-scoped history for follow-up and handoffs.

## What is implemented

- **Care Circle and access:** Firebase-authenticated adult accounts, invitation-based membership, server-resolved roles and permissions, and member/device management.
- **Elder pairing and consent:** one-time device pairing, elder PIN protection, and elder-controlled care-sharing consent.
- **Medication routines:** add, edit, pause, and discontinue schedules; timezone-aware dose records; historical dose snapshots.
- **Care Signals:** elder-reported “I'm okay,” “Not yet,” and “I need help” actions. A response is not proof that medicine was taken; no response remains unconfirmed.
- **Shared responsibility:** help alerts can be claimed transactionally by an authorized helper, then resolved with a recorded outcome.
- **In-app notifications and appointments:** appointment coordination and a caregiver-triggered reminder check. Notifications are stored in the app; continuous or exact-time delivery is not guaranteed.
- **Care Memory:** an attributed timeline of relevant circle actions, subject to role permissions.
- **English/Hindi and accessible Elder Mode:** larger controls and text sizing on key care screens, with English and Hindi interface support.
- **Demo mode:** `/demo` uses fictional browser-local data and simulated time. It does not write to Firebase or synchronize between devices.

## Privacy and safety

Adult sign-in uses Firebase Authentication; the server exchanges the verified identity for an HttpOnly SAATHI session. Firebase Admin performs privileged Firestore operations on the server. The browser does not access Firestore directly, and the repository rules deny direct client reads and writes. APIs derive circle scope and permissions from the server session.

SAATHI supports care coordination. It does not diagnose, prescribe, determine whether a medicine is clinically appropriate, or provide emergency response. Care Signals are reports from the elder, not medical verification. In an emergency, contact local emergency services or a trusted person directly.

## Technology

Next.js App Router, React, TypeScript, Tailwind CSS, Firebase Authentication, Cloud Firestore, and Firebase Admin SDK. The intended zero-payment hosting target is Vercel Hobby with Firebase Spark; free-tier limits and availability are not guaranteed.

## Screenshots

Screenshots are not included yet.

<!-- Add verified screenshots of Elder Mode, Care Circle, and the demo here. -->

## Run locally

Requires Node.js compatible with `package.json` and npm.

```bash
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Fill `.env.local` with the names in `.env.example` before testing real authentication or care-circle APIs. Keep it private and never commit it. Firebase Admin values and the PIN/pairing peppers are server-only. See [Firebase setup](docs/FIREBASE_SETUP.md). The fictional demo can be explored at `http://localhost:3000/demo` without treating it as live Firebase behavior.

## Checks

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

The current suite contains 27 tests for authentication helpers, permissions, scheduling, and demo workflows. These tests do not replace a full live Firebase smoke test.

## Status and limitations

Local tests, lint, typecheck, and production build have passed in the isolated verification copy. Firebase Admin connectivity and selected authentication/pairing operations have been verified separately. The live after-fix behavior of Care Memory, Notifications, and Doses has not been confirmed. Production Firebase environment configuration and end-to-end production behavior must be verified before claiming those integrations work.

Reminder processing is caregiver-triggered; there is no guaranteed background schedule. Email, SMS, WhatsApp, browser push, Gemini prescription scanning, and voice logging are not implemented in this MVP. Demo data is fictional and local to the browser.

## Project

- Repository: [Anshum-Sahoo/Saathi](https://github.com/Anshum-Sahoo/Saathi)
- Deployment: no verified public deployment URL is currently listed.
- Reference: [SAATHI engineering and product reference](docs/SAATHI_REFERENCE.md)
