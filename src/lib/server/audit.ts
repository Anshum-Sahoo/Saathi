import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { MemberRecord } from "@/lib/auth/types";

export async function recordEvent(
  db: Firestore,
  circleId: string,
  type: string,
  actor: { memberId: string; displayName: string; role: string },
  subject: { kind: string; id: string },
  data: Record<string, string | boolean | number | null> = {},
) {
  await db.collection("events").add({
    circleId, type, actor, subject, data,
    visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"],
    createdAt: Timestamp.now(),
  });
}

export function actorFor(memberId: string, member: MemberRecord) {
  return { memberId, displayName: member.displayName, role: member.role };
}
