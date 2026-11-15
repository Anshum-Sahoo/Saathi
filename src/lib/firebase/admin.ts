import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null | undefined;
let firestore: Firestore | null | undefined;
let auth: Auth | null | undefined;

export function getAdminApp(): App | null {
  if (app !== undefined) return app;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) return (app = null);

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (Boolean(clientEmail) !== Boolean(privateKey)) return (app = null);
  if (process.env.VERCEL && !clientEmail) return (app = null);
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();

  app = getApps()[0] ?? initializeApp({ projectId, credential });
  return app;
}

/** Returns null until a Firebase project is configured; preview and health routes do not require it. */
export function getAdminFirestore(): Firestore | null {
  if (firestore !== undefined) return firestore;
  const firebaseApp = getAdminApp();
  return (firestore = firebaseApp ? getFirestore(firebaseApp) : null);
}

export function getAdminAuth(): Auth | null {
  if (auth !== undefined) return auth;
  const firebaseApp = getAdminApp();
  return (auth = firebaseApp ? getAuth(firebaseApp) : null);
}
