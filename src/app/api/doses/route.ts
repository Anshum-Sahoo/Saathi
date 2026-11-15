import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireAction, requireContext } from "@/lib/auth/guard";
import { dosesForDate, doseUiState, localDateInZone, localTimeToUtc } from "@/lib/care/schedule";
import { ensureActiveCircle } from "@/lib/care/firestore";
import { apiRoute, ApiError } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const context = await requireAction(request, "viewSchedule");
  ensureActiveCircle(context);
  const params = new URL(request.url).searchParams;
  const requestedDate = params.get("date") ?? "today";
  if (requestedDate !== "today") throw new ApiError(400, "VALIDATION_ERROR", "Only today's schedule is available.");
  const db = requireFirestore();
  const now = new Date();
  const localDate = localDateInZone(now, context.circle.timezone);
  const meds = await db.collection("medications").where("circleId", "==", context.circleId).get();
  const active = meds.docs.filter((doc) => doc.data().status === "active").map((doc) => ({ id: doc.id, ...doc.data() })) as Array<Parameters<typeof dosesForDate>[0][number]>;
  const scheduled = dosesForDate(active, localDate, context.circle.timezone);
  for (let offset = 0; offset < scheduled.length; offset += 10) {
    await Promise.all(scheduled.slice(offset, offset + 10).map(async (dose) => {
      const ref = db.collection("doses").doc(dose.id);
      await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (!existing.exists) transaction.create(ref, {
          circleId: context.circleId, medicationId: dose.medicationId, snapshot: dose.snapshot,
          scheduledAt: Timestamp.fromDate(dose.scheduledAt), state: "scheduled", snoozeCount: 0,
          alertId: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), version: 1,
        });
      });
    }));
  }
  const dayStart = localTimeToUtc(localDate, "00:00", context.circle.timezone);
  const tomorrowDate = new Date(`${localDate}T00:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const nextDate = tomorrowDate.toISOString().slice(0, 10);
  const dayEnd = localTimeToUtc(nextDate, "00:00", context.circle.timezone);
  const snapshot = await db.collection("doses").where("circleId", "==", context.circleId)
    .where("scheduledAt", ">=", Timestamp.fromDate(dayStart)).where("scheduledAt", "<", Timestamp.fromDate(dayEnd)).orderBy("scheduledAt", "asc").get();
  const doses = snapshot.docs.map((doc) => {
    const data = doc.data();
    const scheduledAt = data.scheduledAt.toDate() as Date;
    const snoozedUntil = data.snoozedUntil?.toDate() as Date | undefined;
    return {
      id: doc.id, medicationId: data.medicationId, snapshot: data.snapshot,
      scheduledAt: scheduledAt.toISOString(), state: data.state,
      uiState: doseUiState({ state: data.state, scheduledAt, snoozedUntil }, now),
      ...(snoozedUntil ? { snoozedUntil: snoozedUntil.toISOString() } : {}),
      snoozeCount: data.snoozeCount ?? 0, alertId: data.alertId ?? null,
    };
  });
  return Response.json({ date: localDate, timezone: context.circle.timezone, doses }, { headers: { "Cache-Control": "no-store" } });
});
