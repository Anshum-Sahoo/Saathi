import { requireAction } from "@/lib/auth/guard";
import { apiRoute } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const context = await requireAction(request, "receiveAlerts");
  const snapshot = await requireFirestore().collection("alerts").where("circleId", "==", context.circleId)
    .where("status", "in", ["open", "claimed"]).orderBy("createdAt", "desc").limit(50).get();
  const alerts = snapshot.docs.filter((doc) => context.member.role === "elder" || doc.data().notifiedMemberIds?.includes(context.memberId)).map((doc) => {
    const data = doc.data();
    return { id: doc.id, type: data.type, reason: data.reason ?? null, description: data.description ?? null, status: data.status,
      createdAt: data.createdAt.toDate().toISOString(), claimedAt: data.claimedAt?.toDate().toISOString() ?? null,
      claimedBy: data.claimedBy ? { memberId: data.claimedBy, displayName: data.claimedByName } : null,
      doseId: data.doseId ?? null };
  });
  return Response.json({ alerts }, { headers: { "Cache-Control": "no-store" } });
});
