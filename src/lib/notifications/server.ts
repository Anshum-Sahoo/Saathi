import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export function inAppNotification(input: {
  circleId: string;
  memberId: string;
  category: string;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string>;
  recordType: "dose" | "alert" | "appointment";
  recordId: string;
  reminderVersion?: number;
}) {
  return {
    circleId: input.circleId, memberId: input.memberId, channel: "in_app", category: input.category,
    titleKey: input.titleKey, bodyKey: input.bodyKey, params: input.params ?? {},
    recordType: input.recordType, recordId: input.recordId,
    ...(input.reminderVersion === undefined ? {} : { reminderVersion: input.reminderVersion }),
    createdAt: FieldValue.serverTimestamp(), readAt: null, expireAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60_000),
  };
}

export function notificationId(...parts: string[]) {
  return `inapp_${parts.join("_")}`.replace(/[^A-Za-z0-9_-]/g, "_");
}
