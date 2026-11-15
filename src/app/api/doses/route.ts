import { Timestamp } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { doseUiState, localDateInZone, localTimeToUtc } from "@/lib/care/schedule";
import { ensureActiveCircle } from "@/lib/care/firestore";
import { apiRoute, ApiError, logApiFailure } from "@/lib/server/http";
import { safeDate } from "@/lib/server/safe-date";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  let stage = "session_resolution";
  try {
    const context = await requireAction(request, "viewSchedule");
    stage = "circle_context_resolution";
    ensureActiveCircle(context);
    const requestedDate = new URL(request.url).searchParams.get("date") ?? "today";
    if (requestedDate !== "today") throw new ApiError(400, "VALIDATION_ERROR", "Only today's schedule is available.");
    const now = new Date();
    stage = "schedule_calculation";
    const localDate = localDateInZone(now, context.circle.timezone);
    const dayStart = localTimeToUtc(localDate, "00:00", context.circle.timezone);
    const tomorrowDate = new Date(`${localDate}T00:00:00Z`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const dayEnd = localTimeToUtc(tomorrowDate.toISOString().slice(0, 10), "00:00", context.circle.timezone);
    stage = "firestore_query";
    const snapshot = await requireFirestore().collection("doses").where("circleId", "==", context.circleId)
      .where("scheduledAt", ">=", Timestamp.fromDate(dayStart)).where("scheduledAt", "<", Timestamp.fromDate(dayEnd))
      .orderBy("scheduledAt", "asc").get();
    stage = "document_mapping";
    const doses = snapshot.docs.flatMap((doc) => {
      const data = doc.data();
      const scheduledAt = safeDate(data.scheduledAt);
      const snoozedUntil = safeDate(data.snoozedUntil);
      if (!scheduledAt || typeof data.state !== "string") {
        logApiFailure("GET /api/doses", "timestamp_serialization", new TypeError("Invalid dose schedule record"));
        return [];
      }
      if (data.state === "cancelled" && scheduledAt > now) return [];
      return [{
        id: doc.id, medicationId: data.medicationId, snapshot: data.snapshot,
        scheduledAt: scheduledAt.toISOString(), state: data.state,
        uiState: doseUiState({ state: data.state, scheduledAt, snoozedUntil }, now),
        ...(snoozedUntil ? { snoozedUntil: snoozedUntil.toISOString() } : {}),
        snoozeCount: typeof data.snoozeCount === "number" ? data.snoozeCount : 0,
        alertId: typeof data.alertId === "string" ? data.alertId : null,
      }];
    });
    stage = "timestamp_serialization";
    return Response.json({ date: localDate, timezone: context.circle.timezone, doses }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logApiFailure("GET /api/doses", stage, error);
    throw error;
  }
});
