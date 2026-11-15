import { FieldValue } from "firebase-admin/firestore";
import { requireContext } from "@/lib/auth/guard";
import { helpSchema } from "@/lib/care/schemas";
import { alertRecipients, ensureActiveCircle, eventRecord } from "@/lib/care/firestore";
import { apiRoute, ApiError, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireContext(request);
  if (context.member.role !== "elder" || context.session.kind !== "elder_device") throw new ApiError(403, "FORBIDDEN", "Only the paired elder device can request help.");
  ensureActiveCircle(context);
  const input = await readJson(request, helpSchema);
  const db = requireFirestore();
  const circleRef = db.collection("circles").doc(context.circleId);
  const alertRef = db.collection("alerts").doc(`help_${input.requestId.replaceAll("-", "")}`);
  const eventRef = db.collection("events").doc(`help_requested_${input.requestId.replaceAll("-", "")}`);
  const recipients = await alertRecipients(db, context.circleId);
  let response: Record<string, unknown> = {};
  await db.runTransaction(async (transaction) => {
    const circleSnapshot = await transaction.get(circleRef);
    const circle = circleSnapshot.data();
    if (!circleSnapshot.exists) throw new ApiError(404, "NOT_FOUND", "This care circle could not be found.");
    const existingAlertRef = typeof circle.activeHelpAlertId === "string" ? db.collection("alerts").doc(circle.activeHelpAlertId) : null;
    const existingAlertSnapshot = existingAlertRef ? await transaction.get(existingAlertRef) : null;
    const requestSnapshot = await transaction.get(alertRef);
    const doseRef = input.doseId ? db.collection("doses").doc(input.doseId) : null;
    const doseSnapshot = doseRef ? await transaction.get(doseRef) : null;
    if (doseSnapshot && (!doseSnapshot.exists || doseSnapshot.data()?.circleId !== context.circleId)) throw new ApiError(404, "NOT_FOUND", "This routine could not be found.");
    const active = existingAlertSnapshot?.data();
    if (existingAlertSnapshot?.exists && ["open", "claimed"].includes(String(active?.status))) {
      response = { id: existingAlertSnapshot.id, type: active.type, status: active.status, reason: active.reason, claimedBy: active.claimedBy ?? null, deduplicated: true };
      return;
    }
    if (requestSnapshot.exists) {
      const prior = requestSnapshot.data()!;
      response = { id: requestSnapshot.id, type: prior.type, status: prior.status, reason: prior.reason, claimedBy: prior.claimedBy ?? null, deduplicated: true };
      return;
    }
    if (doseSnapshot && !["scheduled", "reminded", "snoozed", "unconfirmed", "needs_help"].includes(String(doseSnapshot.data()?.state))) {
      throw new ApiError(409, "INVALID_STATE", "This routine can no longer receive a help request.");
    }
    transaction.create(alertRef, {
      circleId: context.circleId, type: "help_request", reason: input.reason,
      ...(input.reason === "other" && input.description ? { description: input.description } : {}),
      doseId: input.doseId ?? null, status: "open", step: 1, exhausted: false,
      notifiedMemberIds: recipients, createdBy: context.memberId,
      createdAt: FieldValue.serverTimestamp(), version: 1,
    });
    transaction.update(circleRef, { activeHelpAlertId: alertRef.id });
    if (doseRef && doseSnapshot?.exists) transaction.update(doseRef, { state: "needs_help", alertId: alertRef.id, updatedAt: FieldValue.serverTimestamp(), version: FieldValue.increment(1) });
    transaction.create(eventRef, eventRecord(context, "help.requested", { kind: "alert", id: alertRef.id }, { reason: input.reason }));
    response = { id: alertRef.id, type: "help_request", status: "open", reason: input.reason, claimedBy: null, deduplicated: false };
  });
  return Response.json({ alert: response, message: "SAATHI is not an emergency-response service. For an emergency, contact local emergency services or a trusted person directly." }, { status: response.deduplicated ? 200 : 201, headers: { "Cache-Control": "no-store" } });
});
