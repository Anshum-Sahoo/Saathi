import "server-only";
import { FieldValue, type Firestore, type Timestamp } from "firebase-admin/firestore";
import type { AuthContext } from "@/lib/auth/sessions";
import { ApiError } from "@/lib/server/http";

export function ensureActiveCircle(context: AuthContext) {
  if (context.circle.status !== "active") throw new ApiError(409, "CIRCLE_NOT_ACTIVE", "The elder must first accept care sharing.");
}

export function ensureDocumentId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new ApiError(404, "NOT_FOUND", "This item could not be found.");
}

export function eventRecord(context: AuthContext, type: string, subject: { kind: string; id: string }, data: Record<string, string | number | boolean | null> = {}) {
  return {
    circleId: context.circleId,
    type,
    actor: { memberId: context.memberId, displayName: context.member.displayName, role: context.member.role },
    subject,
    data,
    visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"],
    createdAt: FieldValue.serverTimestamp(),
  };
}

export function asDate(value: Timestamp | Date | undefined): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : value.toDate();
}

export async function alertRecipients(db: Firestore, circleId: string) {
  const members = await db.collection("members").where("circleId", "==", circleId).where("status", "==", "active").get();
  return members.docs.filter((doc) => doc.data().role !== "elder" && doc.data().permissions?.receiveAlerts === true).map((doc) => doc.id);
}
