import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireContext } from "@/lib/auth/guard";
import { signalSchema } from "@/lib/care/schemas";
import { ensureActiveCircle, ensureDocumentId, eventRecord } from "@/lib/care/firestore";
import { doseSignalDecision } from "@/lib/care/transitions";
import { alertRecipients } from "@/lib/care/firestore";
import { inAppNotification, notificationId } from "@/lib/notifications/server";
import { apiRoute, ApiError, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export const POST = apiRoute(async (request: Request, route: RouteContext) => {
  requireOrigin(request);
  const context = await requireContext(request);
  if (context.member.role !== "elder" || context.session.kind !== "elder_device") throw new ApiError(403, "FORBIDDEN", "Only the paired elder device can send a care signal.");
  ensureActiveCircle(context);
  const input = await readJson(request, signalSchema);
  const { id } = await route.params;
  ensureDocumentId(id);
  const db = requireFirestore();
  const notifyMembers = input.signal === "not_yet" ? await alertRecipients(db, context.circleId) : [];
  const ref = db.collection("doses").doc(id);
  const eventRef = db.collection("events").doc(`dose_action_${id}_${input.requestId}`);
  let response: Record<string, unknown> = {};
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const dose = snapshot.data();
    if (!snapshot.exists || dose?.circleId !== context.circleId) throw new ApiError(404, "NOT_FOUND", "This routine could not be found.");
    if (dose.lastRequestId === input.requestId) {
      response = { id, state: dose.state, snoozedUntil: dose.snoozedUntil?.toDate().toISOString() ?? null, snoozeCount: dose.snoozeCount ?? 0, replayed: true };
      return;
    }
    const now = Date.now();
    const decision = doseSignalDecision({ state: dose.state, scheduledAt: dose.scheduledAt.toMillis(), snoozedUntil: dose.snoozedUntil?.toMillis(), signal: input.signal, now });
    if (decision === "replay") {
      response = { id, state: "snoozed", snoozedUntil: dose.snoozedUntil.toDate().toISOString(), snoozeCount: dose.snoozeCount ?? 0, replayed: true };
      return;
    }
    if (decision === "invalid") throw new ApiError(409, "INVALID_STATE", "This routine cannot be changed in its current state.");
    const patch = input.signal === "ok"
      ? { state: "confirmed", confirmedAt: FieldValue.serverTimestamp(), confirmedBy: context.memberId, nextAction: FieldValue.delete(), nextActionAt: FieldValue.delete(), snoozedUntil: FieldValue.delete(), lastRequestId: input.requestId }
      : { state: "snoozed", snoozedUntil: Timestamp.fromMillis(now + 15 * 60_000), snoozeCount: FieldValue.increment(1), nextAction: "remind", nextActionAt: Timestamp.fromMillis(now + 15 * 60_000), lastRequestId: input.requestId };
    const nextSnoozeCount = (dose.snoozeCount ?? 0) + 1;
    const notificationRefs = notifyMembers.map((memberId) => db.collection("notifications").doc(notificationId("dose_snoozed", id, String(nextSnoozeCount), memberId)));
    const notifications = await Promise.all(notificationRefs.map((notificationRef) => transaction.get(notificationRef)));
    transaction.update(ref, { ...patch, updatedAt: FieldValue.serverTimestamp(), version: FieldValue.increment(1) });
    transaction.create(eventRef, eventRecord(context, input.signal === "ok" ? "dose.confirmed" : "dose.snoozed", { kind: "dose", id }, { report: input.signal === "ok" ? "elder_self_report" : "requested_delay" }));
    if (input.signal === "not_yet") for (let index = 0; index < notificationRefs.length; index++) {
      if (notifications[index].exists) continue;
      transaction.create(notificationRefs[index], inAppNotification({ circleId: context.circleId, memberId: notifyMembers[index], category: "dose_snooze", titleKey: "notification.snooze.title", bodyKey: "notification.snooze.body", recordType: "dose", recordId: id }));
    }
    response = { id, state: input.signal === "ok" ? "confirmed" : "snoozed", snoozedUntil: input.signal === "ok" ? null : new Date(now + 15 * 60_000).toISOString(), snoozeCount: (dose.snoozeCount ?? 0) + (input.signal === "ok" ? 0 : 1), replayed: false };
  });
  return Response.json({ dose: response }, { headers: { "Cache-Control": "no-store" } });
});
