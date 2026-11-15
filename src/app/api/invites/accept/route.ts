import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { protectedCode } from "@/lib/auth/crypto";
import { defaultPermissions, isAllowedPermissionSet, isInvitableRole } from "@/lib/auth/permissions";
import { prepareSession, setSessionCookie, type PreparedSession } from "@/lib/auth/sessions";
import type { MemberRecord } from "@/lib/auth/types";
import { ApiError, apiRoute, getBearerToken, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import { enforceIpLimit } from "@/lib/server/rate-limit";
import { verifyFirebaseIdToken } from "@/lib/auth/firebase-token";
import { memberIdForFirebaseUid } from "@/lib/auth/member-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().trim().min(10).max(20), displayName: z.string().trim().min(1).max(80) }).strict();

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const input = await readJson(request, schema);
  const auth = getAdminAuth();
  if (!auth) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Authentication is not configured yet.");
  const db = requireFirestore();
  await enforceIpLimit(request, db, "invite-accept", 10);
  let identity;
  try { identity = await verifyFirebaseIdToken(auth, getBearerToken(request)); }
  catch { throw new ApiError(401, "UNAUTHENTICATED", "Sign in to accept this invitation."); }
  const inviteRef = db.collection("invites").doc(protectedCode(input.code));
  const memberRef = db.collection("members").doc(memberIdForFirebaseUid(identity.uid));
  const eventRef = db.collection("events").doc();
  const memberEventRef = db.collection("events").doc();
  const now = Timestamp.now();
  let memberData: MemberRecord | undefined;
  let session: PreparedSession | undefined;

  await db.runTransaction(async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteRef);
    if (!inviteSnapshot.exists) throw new ApiError(404, "NOT_FOUND", "This invitation is not valid.");
    const invite = inviteSnapshot.data()!;
    if (invite.kind !== "member" || invite.usedAt || invite.expiresAt.toMillis() <= now.toMillis()) {
      throw new ApiError(409, "INVALID_STATE", "This invitation has expired or was already used.");
    }
    const circleSnapshot = await transaction.get(db.collection("circles").doc(invite.circleId));
    if (!circleSnapshot.exists || circleSnapshot.data()?.status !== "active") throw new ApiError(409, "INVALID_STATE", "The elder has not accepted care sharing yet.");
    const existing = await transaction.get(memberRef);
    if (existing.exists && (existing.data()?.status === "active" || existing.data()?.circleId !== invite.circleId)) {
      throw new ApiError(409, "INVALID_STATE", "This account already belongs to a care circle.");
    }
    if (!isInvitableRole(invite.role)) throw new ApiError(409, "INVALID_STATE", "This invitation cannot be used.");
    const role = invite.role;
    const permissions = invite.permissions ?? defaultPermissions(role);
    if (!isAllowedPermissionSet(role, permissions)) throw new ApiError(409, "INVALID_STATE", "This invitation cannot be used.");
    memberData = {
      circleId: invite.circleId, role, tier: invite.tier ?? "circle", displayName: input.displayName,
      ...(identity.email ? { email: identity.email, emailNormalized: identity.email.toLowerCase() } : {}),
      firebaseUid: identity.uid, permissions, status: "active", createdAt: now, version: (existing.data()?.version ?? 0) + 1,
    };
    transaction.update(inviteRef, { usedAt: now });
    transaction.set(memberRef, memberData);
    transaction.create(eventRef, {
      circleId: invite.circleId, type: "invite.accepted", actor: { memberId: memberRef.id, displayName: input.displayName, role },
      subject: { kind: "invite", id: inviteRef.id }, data: {},
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
    transaction.create(memberEventRef, {
      circleId: invite.circleId, type: "member.joined", actor: { memberId: memberRef.id, displayName: input.displayName, role },
      subject: { kind: "member", id: memberRef.id }, data: {},
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
    session = prepareSession(memberRef.id, memberData, "member");
    transaction.create(db.collection("sessions").doc(session.sessionId), session.data);
  });

  if (!memberData || !session) throw new ApiError(500, "INTERNAL_ERROR", "The invitation could not be accepted.");
  const headers = new Headers({ "Cache-Control": "no-store" });
  setSessionCookie(headers, session.token, session.expiresAt);
  return Response.json({ member: { id: memberRef.id, displayName: memberData.displayName, role: memberData.role } }, { status: 201, headers });
});
