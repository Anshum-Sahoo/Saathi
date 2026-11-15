import { FieldValue } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { resolveSchema } from "@/lib/care/schemas";
import { ensureDocumentId, eventRecord } from "@/lib/care/firestore";
import { inAppNotification, notificationId } from "@/lib/notifications/server";
import { apiRoute, ApiError, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export const POST = apiRoute(async (request: Request, route: RouteContext) => {
  requireOrigin(request);
  const context = await requireAction(request, "receiveAlerts");
  if (context.member.role === "elder") throw new ApiError(403, "FORBIDDEN", "Only the person handling this alert can resolve it.");
  const input = await readJson(request, resolveSchema);
  const { id } = await route.params;
  ensureDocumentId(id);
  const db = requireFirestore();
  const alertRef = db.collection("alerts").doc(id);
  const circleRef = db.collection("circles").doc(context.circleId);
  const eventRef = db.collection("events").doc(`alert_resolved_${id}`);
  let response: Record<string, unknown> = {};
  await db.runTransaction(async (transaction) => {
    const [alertSnapshot, circleSnapshot] = await Promise.all([transaction.get(alertRef), transaction.get(circleRef)]);
    const alert = alertSnapshot.data();
    if (!alertSnapshot.exists || alert?.circleId !== context.circleId) throw new ApiError(404, "NOT_FOUND", "This care alert could not be found.");
    if (alert.status === "resolved" && alert.resolvedBy === context.memberId) {
      response = { id, status: "resolved", outcome: alert.outcome, replayed: true };
      return;
    }
    if (alert.status !== "claimed" || alert.claimedBy !== context.memberId) throw new ApiError(403, "FORBIDDEN", "Only the person who claimed this alert can resolve it.");
    const otherMembers = (alert.notifiedMemberIds as string[]).filter((memberId) => memberId !== context.memberId);
    const notificationRefs = otherMembers.map((memberId) => db.collection("notifications").doc(notificationId("alert_resolved", id, memberId)));
    const notifications = await Promise.all(notificationRefs.map((ref) => transaction.get(ref)));
    transaction.update(alertRef, { status: "resolved", outcome: input.outcome, resolutionRequestId: input.requestId, resolvedBy: context.memberId, resolvedByName: context.member.displayName, resolvedAt: FieldValue.serverTimestamp(), version: FieldValue.increment(1) });
    if (circleSnapshot.data()?.activeHelpAlertId === id) transaction.update(circleRef, { activeHelpAlertId: FieldValue.delete() });
    transaction.create(eventRef, eventRecord(context, "alert.resolved", { kind: "alert", id }, { outcome: input.outcome }));
    for (let index = 0; index < notificationRefs.length; index++) if (!notifications[index].exists) transaction.create(notificationRefs[index], inAppNotification({
      circleId: context.circleId, memberId: otherMembers[index], category: "alert_resolved", titleKey: "notification.resolved.title", bodyKey: "notification.resolved.body",
      params: { name: context.member.displayName }, recordType: "alert", recordId: id,
    }));
    response = { id, status: "resolved", outcome: input.outcome, replayed: false };
  });
  return Response.json({ alert: response }, { headers: { "Cache-Control": "no-store" } });
});
