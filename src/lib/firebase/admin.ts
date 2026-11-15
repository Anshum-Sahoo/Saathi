import "server-only";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let firestore: Firestore | null | undefined;

/** Returns null until a Firebase project is configured; preview and health routes do not require it. */
export function getAdminFirestore(): Firestore | null {
  if (firestore !== undefined) return firestore;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    firestore = null;
    return firestore;
  }

  const app = getApps()[0] ?? initializeApp({ projectId, credential: applicationDefault() });
  firestore = getFirestore(app);
  return firestore;
}
