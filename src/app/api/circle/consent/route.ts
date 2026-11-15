import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { hashPin } from "@/lib/auth/crypto";
import { requireContext } from "@/lib/auth/guard";
import type { MemberRecord } from "@/lib/auth/types";
import { ApiError, apiRoute, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ pin: z.string().regex(/^\d{4,6}$/), confirmPin: z.string().regex(/^\d{4,6}$/), accepted: z.literal(true) }).strict();

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireContext(request);
  if (context.member.role !== "elder" || context.session.kind !== "elder_device") throw new ApiError(403, "FORBIDDEN", "Only the elder can accept care sharing.");
  const input = await readJson(request, schema);
  if (input.pin !== input.confirmPin) throw new ApiError(400, "VALIDATION_ERROR", "The PINs do not match.");
  if (context.circle.status !== "pending_consent" || context.member.pinHash) throw new ApiError(409, "INVALID_STATE", "Care sharing has already been set up.");
  if (!process.env.ELDER_PIN_PEPPER) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Elder PIN security is not configured yet.");
  const pinHash = await hashPin(input.pin);
  const db = requireFirestore();
  const memberRef = db.collection("members").doc(context.memberId);
  const circleRef = db.collection("circles").doc(context.circleId);
  const eventRef = db.collection("events").doc();
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const [memberDoc, circleDoc] = await Promise.all([transaction.get(memberRef), transaction.get(circleRef)]);
    if (!memberDoc.exists || !circleDoc.exists || circleDoc.data()?.status !== "pending_consent" || memberDoc.data()?.pinHash) {
      throw new ApiError(409, "INVALID_STATE", "Care sharing has already been set up.");
    }
    transaction.update(memberRef, { pinHash, version: (memberDoc.data()?.version ?? 0) + 1 });
    transaction.update(circleRef, {
      status: "active", consent: { acceptedAt: now, acceptedByMemberId: context.memberId, version: 1 },
      updatedAt: now, version: (circleDoc.data()?.version ?? 0) + 1,
    });
    transaction.create(eventRef, {
      circleId: context.circleId, type: "consent.accepted",
      actor: { memberId: context.memberId, displayName: (memberDoc.data() as MemberRecord).displayName, role: "elder" },
      subject: { kind: "circle", id: context.circleId }, data: { consentVersion: 1 },
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
  });
  return Response.json({ ok: true, circleStatus: "active" }, { status: 200, headers: { "Cache-Control": "no-store" } });
});
