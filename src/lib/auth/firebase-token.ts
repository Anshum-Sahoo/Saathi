import type { Auth, DecodedIdToken } from "firebase-admin/auth";

export function verifyFirebaseIdToken(auth: Pick<Auth, "verifyIdToken">, token: string): Promise<DecodedIdToken> {
  return auth.verifyIdToken(token, true);
}
