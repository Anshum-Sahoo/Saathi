import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { hashPin } from "@/lib/auth/crypto";
import { verifyElderPin } from "@/lib/auth/pin";
import { requireContext } from "@/lib/auth/guard";
import { actorFor } from "@/lib/server/audit";
import { ApiError, apiRoute, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ oldPin: z.string().regex(/^\d{4,6}$/), pin: z.string().regex(/^\d{4,6}$/), confirmPin: z.string().regex(/^\d{4,6}$/) }).strict();

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireContext(request);
  if (context.member.role !== "elder" || !context.member.pinHash) throw new ApiError(403, "FORBIDDEN", "PIN changes are available on the elder device.");
  const input = await readJson(request, schema);
  if (input.pin !== input.confirmPin) throw new ApiError(400, "VALIDATION_ERROR", "The PINs do not match.");
  if (!process.env.ELDER_PIN_PEPPER) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Elder PIN security is not configured yet.");
  await verifyElderPin(requireFirestore(), context.memberId, input.oldPin, context.member.pinHash);
  const pinHash = await hashPin(input.pin);
  const db = requireFirestore();
  const memberRef = db.collection("members").doc(context.memberId);
  const eventRef = db.collection("events").doc();
  await db.runTransaction(async (transaction) => {
    const member = await transaction.get(memberRef);
    if (!member.exists || member.data()?.status !== "active" || member.data()?.role !== "elder") throw new ApiError(401, "UNAUTHENTICATED", "This device is no longer paired.");
    transaction.update(memberRef, { pinHash, version: (member.data()?.version ?? 0) + 1 });
    transaction.update(db.collection("sessions").doc(context.sessionId), { elevatedUntil: Timestamp.fromMillis(0) });
    transaction.create(eventRef, {
      circleId: context.circleId, type: "pin.changed", actor: actorFor(context.memberId, context.member),
      subject: { kind: "member", id: context.memberId }, data: {},
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: Timestamp.now(),
    });
  });
  return Response.json({ ok: true });
});
