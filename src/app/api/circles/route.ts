import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { defaultPermissions } from "@/lib/auth/permissions";
import { prepareSession, setSessionCookie } from "@/lib/auth/sessions";
import { ApiError, apiRoute, getBearerToken, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import type { CircleRecord, MemberRecord, MemberPermissions } from "@/lib/auth/types";
import { enforceIpLimit } from "@/lib/server/rate-limit";
import { verifyFirebaseIdToken } from "@/lib/auth/firebase-token";
import { memberIdForFirebaseUid } from "@/lib/auth/member-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  caregiverName: z.string().trim().min(1).max(80),
  elderName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().min(1).max(60),
  timezone: z.string().trim().min(1).max(64).default("Asia/Kolkata"),
}).strict();

const elderPermissions = Object.fromEntries(Object.keys(defaultPermissions("caregiver", true)).map((key) => [key, true])) as MemberPermissions;

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const input = await readJson(request, schema);
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); }
  catch { throw new ApiError(400, "VALIDATION_ERROR", "Choose a valid time zone."); }

  const auth = getAdminAuth();
  if (!auth) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Authentication is not configured yet.");
  let identity;
  try { identity = await verifyFirebaseIdToken(auth, getBearerToken(request)); }
  catch { throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue."); }
  const db = requireFirestore();
  await enforceIpLimit(request, db, "circle-create", 5, 60 * 60_000);
  const circleRef = db.collection("circles").doc();
  const caregiverRef = db.collection("members").doc(memberIdForFirebaseUid(identity.uid));
  const elderRef = db.collection("members").doc();
  const eventRef = db.collection("events").doc();
  const elderEventRef = db.collection("events").doc();
  const now = Timestamp.now();
  const email = identity.email ?? undefined;
  const caregiver: MemberRecord = {
    circleId: circleRef.id, role: "caregiver", tier: "primary", displayName: input.caregiverName,
    ...(email ? { email, emailNormalized: email.toLowerCase() } : {}), firebaseUid: identity.uid,
    permissions: defaultPermissions("caregiver", true), status: "active", createdAt: now, version: 1,
  };
  const elder: MemberRecord = {
    circleId: circleRef.id, role: "elder", tier: "circle", displayName: input.preferredName,
    permissions: elderPermissions, status: "active", createdAt: now, version: 1,
  };
  const circle: CircleRecord = {
    elderName: input.elderName, preferredName: input.preferredName, language: "en", timezone: input.timezone,
    status: "pending_consent", createdBy: caregiverRef.id, version: 1,
  };
  const session = prepareSession(caregiverRef.id, caregiver, "member");
  await db.runTransaction(async (transaction) => {
    const existingMember = await transaction.get(caregiverRef);
    if (existingMember.exists) throw new ApiError(409, "INVALID_STATE", "This account already belongs to a care circle.");
    transaction.create(circleRef, { ...circle, createdAt: now, updatedAt: now });
    transaction.create(caregiverRef, caregiver);
    transaction.create(elderRef, elder);
    transaction.create(db.collection("sessions").doc(session.sessionId), session.data);
    transaction.create(eventRef, {
      circleId: circleRef.id, type: "circle.created", actor: { memberId: caregiverRef.id, displayName: input.caregiverName, role: "caregiver" },
      subject: { kind: "circle", id: circleRef.id }, data: { elderMemberId: elderRef.id },
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
    transaction.create(elderEventRef, {
      circleId: circleRef.id, type: "elder.profile_created", actor: { memberId: caregiverRef.id, displayName: input.caregiverName, role: "caregiver" },
      subject: { kind: "member", id: elderRef.id }, data: {},
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
  });
  const headers = new Headers({ "Cache-Control": "no-store" });
  setSessionCookie(headers, session.token, session.expiresAt);
  return Response.json({ circle: { id: circleRef.id, status: circle.status }, member: { id: caregiverRef.id, role: caregiver.role } }, { status: 201, headers });
});
