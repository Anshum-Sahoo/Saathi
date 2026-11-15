import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { medicationPatchSchema } from "@/lib/care/schemas";
import { ensureActiveCircle, ensureDocumentId, eventRecord } from "@/lib/care/firestore";
import { dosesForDate, localDateInZone } from "@/lib/care/schedule";
import { apiRoute, ApiError, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = apiRoute(async (request: Request, context: RouteContext) => {
  requireOrigin(request);
  const auth = await requireAction(request, "editMedications");
  ensureActiveCircle(auth);
  const { id } = await context.params;
  ensureDocumentId(id);
  const input = await readJson(request, medicationPatchSchema);
  if (!Object.keys(input).length) throw new ApiError(400, "VALIDATION_ERROR", "Add at least one change.");
  const db = requireFirestore();
  const ref = db.collection("medications").doc(id);
  const eventRef = db.collection("events").doc();
  let result: Record<string, unknown> = {};
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    if (!snapshot.exists || current?.circleId !== auth.circleId) throw new ApiError(404, "NOT_FOUND", "This medicine could not be found.");
    if (current.status !== "active") throw new ApiError(409, "INVALID_STATE", "Only an active medicine can be edited.");
    const updated = { ...current, ...input, id };
    if (updated.startDate && updated.endDate && updated.endDate < updated.startDate) throw new ApiError(400, "VALIDATION_ERROR", "End date must be on or after the start date.");
    const now = new Date();
    const futureQuery = db.collection("doses").where("circleId", "==", auth.circleId).where("medicationId", "==", id).where("scheduledAt", ">=", Timestamp.fromDate(now));
    const upcoming = await transaction.get(futureQuery);
    const today = localDateInZone(now, auth.circle.timezone);
    const expected = dosesForDate([updated as Parameters<typeof dosesForDate>[0][number]], today, auth.circle.timezone)
      .filter((dose) => dose.scheduledAt.getTime() >= now.getTime());
    const knownIds = new Set(upcoming.docs.map((dose) => dose.id));
    const missingExpected = expected.filter((dose) => !knownIds.has(dose.id));
    const expectedSnapshots = await Promise.all(missingExpected.map((dose) => transaction.get(db.collection("doses").doc(dose.id))));
    const patch = { ...input, updatedAt: FieldValue.serverTimestamp(), updatedBy: auth.memberId, version: FieldValue.increment(1) };
    transaction.update(ref, patch);
    const expectedById = new Map(expected.map((dose) => [dose.id, dose]));
    for (const doseDoc of upcoming.docs) {
      const dose = doseDoc.data();
      const next = expectedById.get(doseDoc.id);
      if (!["scheduled", "reminded", "snoozed"].includes(dose.state)) continue;
      if (next) transaction.update(doseDoc.ref, { snapshot: next.snapshot, updatedAt: FieldValue.serverTimestamp(), version: FieldValue.increment(1) });
      else transaction.update(doseDoc.ref, { state: "cancelled", nextAction: FieldValue.delete(), nextActionAt: FieldValue.delete(), cancelledAt: FieldValue.serverTimestamp(), version: FieldValue.increment(1) });
    }
    for (let index = 0; index < missingExpected.length; index++) {
      const dose = missingExpected[index];
      if (expectedSnapshots[index].exists) continue;
      transaction.create(db.collection("doses").doc(dose.id), {
        circleId: auth.circleId, medicationId: id, snapshot: dose.snapshot, scheduledAt: Timestamp.fromDate(dose.scheduledAt),
        state: "scheduled", snoozeCount: 0, alertId: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), version: 1,
      });
    }
    transaction.create(eventRef, eventRecord(auth, "medication.updated", { kind: "medication", id }, { name: input.name ?? String(current.name) }));
    result = { ...updated };
  });
  return Response.json({ medication: result }, { headers: { "Cache-Control": "no-store" } });
});
