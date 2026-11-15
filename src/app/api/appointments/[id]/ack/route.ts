import { FieldValue } from "firebase-admin/firestore";
import { requireContext } from "@/lib/auth/guard";
import { ensureActiveCircle, ensureDocumentId, eventRecord } from "@/lib/care/firestore";
import { ApiError, apiRoute, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const emptyBody = z.object({}).strict();
type RouteContext = { params: Promise<{ id: string }> };

export const POST = apiRoute(async (request: Request, route: RouteContext) => {
  requireOrigin(request);
  const context = await requireContext(request);
  if (!["family", "caregiver"].includes(context.member.role)) throw new ApiError(403, "FORBIDDEN", "Only the assigned family member or caregiver can acknowledge responsibility.");
  ensureActiveCircle(context);
  await readJson(request, emptyBody);
  const { id } = await route.params;
  ensureDocumentId(id);
  const db = requireFirestore();
  const appointmentRef = db.collection("appointments").doc(id);
  let result: { acknowledged: boolean; replayed: boolean } = { acknowledged: false, replayed: false };
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    const appointment = snapshot.data();
    if (!snapshot.exists || appointment?.circleId !== context.circleId) throw new ApiError(404, "NOT_FOUND", "This appointment could not be found.");
    if (appointment.assignedMemberId !== context.memberId) throw new ApiError(403, "FORBIDDEN", "This appointment is assigned to someone else.");
    if (appointment.status !== "scheduled") throw new ApiError(409, "INVALID_STATE", "This appointment is no longer scheduled.");
    if (appointment.assignedAcknowledgedAt) { result = { acknowledged: true, replayed: true }; return; }
    const eventRef = db.collection("events").doc(`appointment_ack_${id}_v${appointment.version}_${context.memberId}`);
    transaction.update(appointmentRef, { assignedAcknowledgedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    transaction.create(eventRef, eventRecord(context, "appointment.acknowledged", { kind: "appointment", id }, { label: "Appointment responsibility acknowledged" }));
    result = { acknowledged: true, replayed: false };
  });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
});
