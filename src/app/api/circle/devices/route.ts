import { requireContext, requireElevatedElder } from "@/lib/auth/guard";
import { apiRoute, ApiError } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const context = await requireContext(request);
  if (context.member.role === "elder") requireElevatedElder(context);
  else if (context.member.role !== "caregiver" || !context.member.permissions.manageCircle) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to manage paired devices.");
  }
  const snapshot = await requireFirestore().collection("sessions")
    .where("circleId", "==", context.circleId).where("kind", "==", "elder_device").get();
  const now = Date.now();
  return Response.json({ devices: snapshot.docs.flatMap((doc) => {
    const data = doc.data();
    if (data.expiresAt.toMillis() <= now) return [];
    return [{ id: doc.id, memberId: data.memberId, deviceLabel: data.deviceLabel ?? "Elder device", createdAt: data.createdAt.toDate().toISOString(), lastSeenAt: data.lastSeenAt.toDate().toISOString() }];
  }) }, { headers: { "Cache-Control": "no-store" } });
});
