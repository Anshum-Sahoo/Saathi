import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { protectedCode } from "@/lib/auth/crypto";
import { prepareSession, setSessionCookie } from "@/lib/auth/sessions";
import type { MemberRecord } from "@/lib/auth/types";
import { ApiError, apiRoute, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import { enforceIpLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().trim().min(10).max(20) }).strict();

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const { code } = await readJson(request, schema);
  const db = requireFirestore();
  await enforceIpLimit(request, db, "pairing-redeem", 10);
  const inviteRef = db.collection("invites").doc(protectedCode(code));
  const inviteSnapshot = await inviteRef.get();
  if (!inviteSnapshot.exists) throw new ApiError(404, "NOT_FOUND", "That code is not valid. Ask your caregiver for a new one.");
  const invite = inviteSnapshot.data()!;
  if (invite.kind !== "elder_device" || invite.usedAt || invite.expiresAt.toMillis() <= Date.now()) {
    throw new ApiError(404, "NOT_FOUND", "That code is not valid. Ask your caregiver for a new one.");
  }
  const memberRef = db.collection("members").doc(invite.memberId);
  const memberSnapshot = await memberRef.get();
  if (!memberSnapshot.exists || memberSnapshot.data()?.status !== "active") throw new ApiError(404, "NOT_FOUND", "That code is not valid. Ask your caregiver for a new one.");
  const member = memberSnapshot.data() as MemberRecord;
  const session = prepareSession(invite.memberId, member, "elder_device", request.headers.get("user-agent") ?? undefined);
  const now = Timestamp.now();
  const eventRef = db.collection("events").doc();
  await db.runTransaction(async (transaction) => {
    const [current, currentMember, circle] = await Promise.all([
      transaction.get(inviteRef), transaction.get(memberRef), transaction.get(db.collection("circles").doc(invite.circleId)),
    ]);
    if (!current.exists || current.data()?.usedAt || current.data()?.expiresAt.toMillis() <= now.toMillis()) {
      throw new ApiError(404, "NOT_FOUND", "That code is not valid. Ask your caregiver for a new one.");
    }
    if (!currentMember.exists || currentMember.data()?.status !== "active" || currentMember.data()?.role !== "elder" || currentMember.data()?.circleId !== invite.circleId || !circle.exists) {
      throw new ApiError(404, "NOT_FOUND", "That code is not valid. Ask your caregiver for a new one.");
    }
    transaction.update(inviteRef, { usedAt: now });
    transaction.create(eventRef, {
      circleId: invite.circleId, type: "device.paired", actor: { memberId: invite.memberId, displayName: member.displayName, role: "elder" },
      subject: { kind: "member", id: invite.memberId }, data: {},
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
    transaction.create(db.collection("sessions").doc(session.sessionId), session.data);
  });
  const headers = new Headers({ "Cache-Control": "no-store" });
  setSessionCookie(headers, session.token, session.expiresAt);
  return Response.json({ paired: true, needsConsent: !member.pinHash }, { headers });
});
