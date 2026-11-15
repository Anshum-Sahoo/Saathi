# SAATHI

**The care circle that never lets an elder go unnoticed.**

SAATHI is a foundation preview for elder-led care coordination. It introduces elder, caregiver, and family views. Medication and Care Signal actions are visibly disabled until their server workflows are implemented.

## Run locally

Requires Node.js 20.9 or newer and npm.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The foundation works without Firebase credentials.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
```

## Firebase Admin configuration

Copy `.env.example` to `.env.local` and set `FIREBASE_PROJECT_ID`. Server-side Admin access uses Application Default Credentials. The lazy initializer returns `null` when no project is configured, and the health endpoint and preview screens do not require Firebase. Never put service-account keys in source control. No authentication or Firestore workflows are implemented yet, and browser code does not access Firestore.

## Deploy to Vercel Hobby

1. Push the repository to GitHub and import it in Vercel.
2. Keep the framework preset as **Next.js** and use the default install/build settings.
3. Add `FIREBASE_PROJECT_ID` only when configuring a Firebase project. Provide server credentials through Vercel environment settings; do not expose Admin credentials with a `NEXT_PUBLIC_` prefix.
4. Deploy the preview and verify `/api/health` returns HTTP 200.

The foundation requires no Google Cloud billing account, Cloud Run, Docker, or paid service. Firebase Firestore on the Spark plan and Gemini free quota are future options; neither is connected in this phase. Authentication, medication data, reminders, and Gemini scanning are not implemented.

## Routes

- `/` — welcome and entry points.
- `/elder` — Elder Mode preview with a working text-size control and disabled Care Signals.
- `/caregiver` — pending request, ownership, and Care Memory preview.
- `/family` — care circle, signal, and Care Memory preview.
- `/api/health` — dependency-free JSON health check.

All people, medicines, requests, and notes shown in the previews are fictional.

## Legacy prototype

The original Carewell static prototype and README are preserved in [`legacy-prototype/`](./legacy-prototype/). They are a visual reference only; their local-storage data is not connected to SAATHI.
