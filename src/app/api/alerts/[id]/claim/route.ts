import { FieldValue } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { claimSchema } from "@/lib/care/schemas";
import { ensureDocumentId, eventRecord } from "@/lib/care/firestore";
import { alertClaimDecision } from "@/lib/care/transitions";
import { inAppNotification, notificationId } from "@/lib/notifications/server";
import { apiRoute, ApiError, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export const POST = apiRoute(async (request: Request, route: RouteContext) => {
  requireOrigin(request);
  const context = await requireAction(request, "receiveAlerts");
  if (context.member.role === "elder") throw new ApiError(403, "FORBIDDEN", "Only a circle helper can take responsibility.");
  const input = await readJson(request, claimSchema);
  const { id } = await route.params;
  ensureDocumentId(id);
  const db = requireFirestore();
  const alertRef = db.collection("alerts").doc(id);
  const memberRef = db.collection("members").doc(context.memberId);
  const eventRef = db.collection("events").doc(`alert_claim_${id}_${context.memberId}`);
  let response: Record<string, unknown> = {};
  await db.runTransaction(async (transaction) => {
    const [alertSnapshot, memberSnapshot] = await Promise.all([transaction.get(alertRef), transaction.get(memberRef)]);
    const alert = alertSnapshot.data();
    const member = memberSnapshot.data();
    if (!alertSnapshot.exists || alert?.circleId !== context.circleId) throw new ApiError(404, "NOT_FOUND", "This care alert could not be found.");
    const notified = Boolean(alert.notifiedMemberIds?.includes(context.memberId));
    if (!memberSnapshot.exists || member?.circleId !== context.circleId || member.status !== "active" || member.permissions?.receiveAlerts !== true || !notified) {
      throw new ApiError(403, "FORBIDDEN", "You were not invited to handle this alert.");
    }
    const decision = alertClaimDecision({ status: alert.status, claimedBy: alert.claimedBy, memberId: context.memberId, isNotified: notified });
    if (decision === "owned") {
      response = { id, status: alert.status, claimedBy: context.memberId, claimedByName: alert.claimedByName, claimedAt: alert.claimedAt.toDate().toISOString(), replayed: true };
      return;
    }
    if (decision === "taken") throw new ApiError(409, "ALERT_ALREADY_CLAIMED", "Another helper already took responsibility.", { claimedBy: { memberId: alert.claimedBy, displayName: alert.claimedByName }, claimedAt: alert.claimedAt?.toDate().toISOString() ?? null });
    if (decision !== "claim") throw new ApiError(409, "ALERT_ALREADY_CLAIMED", "This alert is no longer open.");
    const otherMembers = (alert.notifiedMemberIds as string[]).filter((memberId) => memberId !== context.memberId);
    const notificationRefs = otherMembers.map((memberId) => db.collection("notifications").doc(notificationId("alert_claimed", id, memberId)));
    const notifications = await Promise.all(notificationRefs.map((ref) => transaction.get(ref)));
    const claimedAt = new Date();
    transaction.update(alertRef, { status: "claimed", claimedBy: context.memberId, claimedByName: member.displayName, claimedAt: FieldValue.serverTimestamp(), version: FieldValue.increment(1) });
    transaction.create(eventRef, eventRecord(context, "alert.claimed", { kind: "alert", id }, {}));
    for (let index = 0; index < notificationRefs.length; index++) if (!notifications[index].exists) transaction.create(notificationRefs[index], inAppNotification({
      circleId: context.circleId, memberId: otherMembers[index], category: "alert_claimed", titleKey: "notification.claimed.title", bodyKey: "notification.claimed.body",
      params: { name: member.displayName }, recordType: "alert", recordId: id,
    }));
    response = { id, status: "claimed", claimedBy: context.memberId, claimedByName: member.displayName, claimedAt: claimedAt.toISOString(), requestId: input.requestId, replayed: false };
  });
  return Response.json({ alert: response }, { headers: { "Cache-Control": "no-store" } });
});
