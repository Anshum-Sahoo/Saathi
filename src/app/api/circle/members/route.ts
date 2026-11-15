import { requireContext } from "@/lib/auth/guard";
import type { MemberRecord } from "@/lib/auth/types";
import { apiRoute } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const context = await requireContext(request);
  const snapshot = await requireFirestore().collection("members")
    .where("circleId", "==", context.circleId).where("status", "==", "active").get();
  const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() as MemberRecord }));
  const visible = context.member.role === "caregiver" || context.member.role === "elder"
    ? rows
    : context.member.role === "family"
      ? rows.filter((row) => row.role === "elder" || row.role === "caregiver" || row.id === context.memberId)
      : rows.filter((row) => row.role === "elder" || row.id === context.memberId);
  return Response.json({ members: visible.map(({ id, displayName, role, tier, permissions, createdAt }) => ({
    id, displayName, role, tier,
    ...(context.member.role === "caregiver" || context.member.role === "elder" || id === context.memberId ? { permissions } : {}),
    createdAt: createdAt.toDate().toISOString(),
  })) }, { headers: { "Cache-Control": "no-store" } });
});
