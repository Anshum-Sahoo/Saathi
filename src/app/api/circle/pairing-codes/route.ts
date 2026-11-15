import { Timestamp } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { createOneTimeCode, protectedCode } from "@/lib/auth/crypto";
import { actorFor } from "@/lib/server/audit";
import { ApiError, apiRoute, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import { enforceIpLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireAction(request, "manageCircle");
  const db = requireFirestore();
  await enforceIpLimit(request, db, "pairing-create", 10);
  const elder = await db.collection("members").where("circleId", "==", context.circleId).where("role", "==", "elder").where("status", "==", "active").limit(1).get();
  if (elder.empty) return Response.json({ error: { code: "NOT_FOUND", message: "The elder profile could not be found.", details: {} } }, { status: 404 });
  let code = createOneTimeCode();
  let ref = db.collection("invites").doc(protectedCode(code));
  let available = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await ref.get()).exists) { available = true; break; }
    code = createOneTimeCode();
    ref = db.collection("invites").doc(protectedCode(code));
  }
  if (!available) throw new ApiError(503, "SERVICE_UNAVAILABLE", "A pairing code could not be created. Please try again.");
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 10 * 60_000);
  const eventRef = db.collection("events").doc();
  await db.runTransaction(async (transaction) => {
    transaction.create(ref, {
      circleId: context.circleId, kind: "elder_device", role: "elder", tier: "circle", memberId: elder.docs[0].id,
      permissions: {}, createdBy: context.memberId, usedAt: null, expiresAt, createdAt: now,
    });
    transaction.create(eventRef, {
      circleId: context.circleId, type: "device.pairing_code_created", actor: actorFor(context.memberId, context.member),
      subject: { kind: "member", id: elder.docs[0].id }, data: { expiresAt: expiresAt.toDate().toISOString() },
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
  });
  return Response.json({ code, expiresAt: expiresAt.toDate().toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
});
