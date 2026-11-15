import { requireContext } from "@/lib/auth/guard";
import { clearSessionCookie } from "@/lib/auth/sessions";
import { ApiError, apiRoute, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import { actorFor } from "@/lib/server/audit";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  let context;
  try {
    context = await requireContext(request);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const headers = new Headers({ "Cache-Control": "no-store" });
    clearSessionCookie(headers);
    return Response.json({ ok: true }, { headers });
  }
  const db = requireFirestore();
  const sessionRef = db.collection("sessions").doc(context.sessionId);
  const eventRef = db.collection("events").doc();
  await db.runTransaction(async (transaction) => {
    const session = await transaction.get(sessionRef);
    if (session.exists) transaction.delete(sessionRef);
    transaction.create(eventRef, {
      circleId: context.circleId, type: "session.revoked", actor: actorFor(context.memberId, context.member),
      subject: { kind: "member", id: context.memberId }, data: {},
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: Timestamp.now(),
    });
  });
  const headers = new Headers({ "Cache-Control": "no-store" });
  clearSessionCookie(headers);
  return Response.json({ ok: true }, { headers });
});
