import { requireAction } from "@/lib/auth/guard";
import { apiRoute, ApiError, logApiFailure } from "@/lib/server/http";
import { safeDate } from "@/lib/server/safe-date";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  let stage = "session_resolution";
  try {
    const context = await requireAction(request, "viewHistory");
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 30);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) throw new ApiError(400, "VALIDATION_ERROR", "Choose a limit from 1 to 50.");
    stage = "firestore_query";
    const events = await requireFirestore().collection("events")
      .where("circleId", "==", context.circleId)
      .where("visibleToRoles", "array-contains", context.member.role)
      .orderBy("createdAt", "desc").limit(rawLimit).get();
    stage = "document_mapping";
    const items = events.docs.flatMap((doc) => {
      const event = doc.data();
      const at = safeDate(event.createdAt);
      if (!at) {
        logApiFailure("GET /api/memory", "timestamp_serialization", new TypeError("Invalid event timestamp"));
        return [];
      }
      return [{ id: doc.id, type: event.type, at: at.toISOString(), actor: event.actor, subject: event.subject, data: event.data ?? {} }];
    });
    stage = "timestamp_serialization";
    return Response.json({ items, nextCursor: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logApiFailure("GET /api/memory", stage, error);
    throw error;
  }
});
