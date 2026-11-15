import { requireAction } from "@/lib/auth/guard";
import { apiRoute, ApiError } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const context = await requireAction(request, "viewHistory");
  const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 30);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) throw new ApiError(400, "VALIDATION_ERROR", "Choose a limit from 1 to 50.");
  const events = await requireFirestore().collection("events")
    .where("circleId", "==", context.circleId)
    .where("visibleToRoles", "array-contains", context.member.role)
    .orderBy("createdAt", "desc").limit(rawLimit).get();
  return Response.json({ items: events.docs.map((doc) => {
    const event = doc.data();
    return {
      id: doc.id, type: event.type, at: event.createdAt.toDate().toISOString(),
      actor: event.actor, subject: event.subject, data: event.data,
    };
  }), nextCursor: null }, { headers: { "Cache-Control": "no-store" } });
});
