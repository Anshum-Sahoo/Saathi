import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { dosesForDate, localDateInZone } from "@/lib/care/schedule";
import { medicationSchema } from "@/lib/care/schemas";
import { ensureActiveCircle, eventRecord } from "@/lib/care/firestore";
import { apiRoute, readJson, requireOrigin, ApiError } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const context = await requireAction(request, "viewSchedule");
  ensureActiveCircle(context);
  const snapshot = await requireFirestore().collection("medications").where("circleId", "==", context.circleId).limit(20).get();
  return Response.json({ medications: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireAction(request, "editMedications");
  ensureActiveCircle(context);
  const input = await readJson(request, medicationSchema);
  const db = requireFirestore();
  const medicationRef = db.collection("medications").doc();
  const eventRef = db.collection("events").doc();
  const now = new Date();
  const today = localDateInZone(now, context.circle.timezone);
  const todaysDoses = dosesForDate([{ id: medicationRef.id, ...input }], today, context.circle.timezone);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(db.collection("medications").where("circleId", "==", context.circleId));
    if (existing.size >= 20) throw new ApiError(409, "MEDICATION_LIMIT", "This circle already has 20 medicines.");
    transaction.create(medicationRef, {
      ...input, circleId: context.circleId, status: "active", createdBy: context.memberId,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: context.memberId, version: 1,
    });
    transaction.create(eventRef, eventRecord(context, "medication.created", { kind: "medication", id: medicationRef.id }, { name: input.name }));
    for (const dose of todaysDoses) transaction.create(db.collection("doses").doc(dose.id), {
      circleId: context.circleId, medicationId: medicationRef.id, snapshot: dose.snapshot,
      scheduledAt: Timestamp.fromDate(dose.scheduledAt), state: "scheduled", snoozeCount: 0,
      alertId: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), version: 1,
    });
  });
  return Response.json({ medication: { id: medicationRef.id, ...input, status: "active" } }, { status: 201, headers: { "Cache-Control": "no-store" } });
});
