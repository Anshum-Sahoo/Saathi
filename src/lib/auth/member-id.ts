import { createHash } from "node:crypto";

export function memberIdForFirebaseUid(uid: string): string {
  return createHash("sha256").update(uid).digest("hex");
}
