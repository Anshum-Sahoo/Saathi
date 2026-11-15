import { Timestamp } from "firebase-admin/firestore";
import { requireContext, requireElevatedElder } from "@/lib/auth/guard";
import { actorFor } from "@/lib/server/audit";
import { ApiError, apiRoute, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = async (request: Request, route: RouteContext) => apiRoute(async (req) => {
  requireOrigin(req);
  const context = await requireContext(req);
  if (context.member.role === "elder") requireElevatedElder(context);
  else if (context.member.role !== "caregiver" || !context.member.permissions.manageCircle) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to revoke paired devices.");
  }
  const { id } = await route.params;
  if (!/^[a-f0-9]{64}$/.test(id)) throw new ApiError(404, "NOT_FOUND", "This device could not be found.");
  const db = requireFirestore();
  const sessionRef = db.collection("sessions").doc(id);
  const eventRef = db.collection("events").doc();
  await db.runTransaction(async (transaction) => {
    const session = await transaction.get(sessionRef);
    if (!session.exists || session.data()?.circleId !== context.circleId || session.data()?.kind !== "elder_device") {
      throw new ApiError(404, "NOT_FOUND", "This device could not be found.");
    }
    transaction.delete(sessionRef);
    transaction.create(eventRef, {
      circleId: context.circleId, type: "device.revoked", actor: actorFor(context.memberId, context.member),
      subject: { kind: "member", id: session.data()?.memberId }, data: {},
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: Timestamp.now(),
    });
  });
  return Response.json({ ok: true });
})(request);
