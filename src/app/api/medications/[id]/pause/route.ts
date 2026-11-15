import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { ensureActiveCircle, ensureDocumentId, eventRecord } from "@/lib/care/firestore";
import { apiRoute, ApiError, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(["paused", "discontinued"]) }).strict();
type RouteContext = { params: Promise<{ id: string }> };

export const POST = apiRoute(async (request: Request, context: RouteContext) => {
  requireOrigin(request);
  const auth = await requireAction(request, "editMedications");
  ensureActiveCircle(auth);
  const { id } = await context.params;
  ensureDocumentId(id);
  const { status } = await readJson(request, schema);
  const db = requireFirestore();
  const ref = db.collection("medications").doc(id);
  const eventRef = db.collection("events").doc();
  await db.runTransaction(async (transaction) => {
    const futureDoses = db.collection("doses").where("circleId", "==", auth.circleId).where("medicationId", "==", id).where("scheduledAt", ">=", Timestamp.now());
    const [snapshot, doses] = await Promise.all([transaction.get(ref), transaction.get(futureDoses)]);
    const current = snapshot.data();
    if (!snapshot.exists || current?.circleId !== auth.circleId) throw new ApiError(404, "NOT_FOUND", "This medicine could not be found.");
    if (current.status !== "active") throw new ApiError(409, "INVALID_STATE", "This medicine is already paused or discontinued.");
    transaction.update(ref, { status, updatedAt: FieldValue.serverTimestamp(), updatedBy: auth.memberId, version: FieldValue.increment(1), materializedThrough: FieldValue.delete() });
    for (const dose of doses.docs) if (["scheduled", "reminded", "snoozed"].includes(dose.data().state)) {
      transaction.update(dose.ref, { state: "cancelled", nextAction: FieldValue.delete(), nextActionAt: FieldValue.delete(), cancelledAt: FieldValue.serverTimestamp(), version: FieldValue.increment(1) });
    }
    transaction.create(eventRef, eventRecord(auth, status === "paused" ? "medication.paused" : "medication.discontinued", { kind: "medication", id }, { name: String(current.name) }));
  });
  return Response.json({ id, status }, { headers: { "Cache-Control": "no-store" } });
});
