import { requireContext } from "@/lib/auth/guard";
import { apiRoute, ApiError, logApiFailure } from "@/lib/server/http";
import { safeDate } from "@/lib/server/safe-date";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  let stage = "session_resolution";
  try {
    const context = await requireContext(request);
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 30);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ApiError(400, "VALIDATION_ERROR", "Choose a limit from 1 to 50.");
    const db = requireFirestore();
    const base = db.collection("notifications").where("circleId", "==", context.circleId)
      .where("memberId", "==", context.memberId).where("channel", "==", "in_app");
    stage = "firestore_query";
    const [snapshot, count] = await Promise.all([
      base.orderBy("createdAt", "desc").limit(limit).get(),
      base.where("readAt", "==", null).count().get(),
    ]);
    stage = "related_document_lookup";
    const appointmentIds = [...new Set(snapshot.docs.flatMap((doc) => {
      const data = doc.data();
      return data.recordType === "appointment" && typeof data.recordId === "string" ? [data.recordId] : [];
    }))];
    const appointments = await Promise.all(appointmentIds.map((id) => db.collection("appointments").doc(id).get()));
    const appointmentById = new Map(appointments.map((doc) => [doc.id, doc.data()]));
    stage = "document_mapping";
    const items = snapshot.docs.flatMap((doc) => {
      const data = doc.data();
      if (data.recordType === "appointment") {
        const appointment = typeof data.recordId === "string" ? appointmentById.get(data.recordId) : undefined;
        if (!appointment || appointment.circleId !== context.circleId || appointment.status !== "scheduled" || appointment.version !== data.reminderVersion) return [];
      }
      const createdAt = safeDate(data.createdAt);
      if (!createdAt) {
        logApiFailure("GET /api/notifications", "timestamp_serialization", new TypeError("Invalid notification timestamp"));
        return [];
      }
      const params = data.params && typeof data.params === "object" && !Array.isArray(data.params)
        ? Object.fromEntries(Object.entries(data.params).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
        : {};
      return [{
        id: doc.id, category: data.category, titleKey: data.titleKey, bodyKey: data.bodyKey, params,
        recordType: data.recordType, recordId: data.recordId,
        href: data.recordType === "appointment" ? `${context.member.role === "family" ? "/family" : "/caregiver"}#appointments` : data.recordType === "dose" ? "/elder" : `${context.member.role === "family" ? "/family" : "/caregiver"}#alerts`,
        createdAt: createdAt.toISOString(), read: data.readAt != null,
      }];
    });
    stage = "timestamp_serialization";
    return Response.json({ items, unreadCount: count.data().count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logApiFailure("GET /api/notifications", stage, error);
    throw error;
  }
});
