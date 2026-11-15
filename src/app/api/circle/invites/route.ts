import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAction } from "@/lib/auth/guard";
import { INVITABLE_ROLES } from "@/lib/auth/permissions";
import { createOneTimeCode, protectedCode } from "@/lib/auth/crypto";
import { actorFor } from "@/lib/server/audit";
import { apiRoute, readJson, requireOrigin, ApiError } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import { enforceIpLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ role: z.enum(INVITABLE_ROLES) }).strict();

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireAction(request, "manageCircle");
  if (context.circle.status !== "active") throw new ApiError(409, "INVALID_STATE", "Wait until the elder has accepted care sharing before inviting members.");
  const input = await readJson(request, schema);
  const db = requireFirestore();
  await enforceIpLimit(request, db, "invite-create", 10);
  let code = createOneTimeCode();
  let inviteRef = db.collection("invites").doc(protectedCode(code));
  let available = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await inviteRef.get()).exists) { available = true; break; }
    code = createOneTimeCode();
    inviteRef = db.collection("invites").doc(protectedCode(code));
  }
  if (!available) throw new ApiError(503, "SERVICE_UNAVAILABLE", "A new invitation could not be created. Please try again.");
  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + 24 * 60 * 60_000);
  await db.runTransaction(async (transaction) => {
    transaction.create(inviteRef, {
      circleId: context.circleId, kind: "member", role: input.role, tier: "circle",
      permissions: input.role === "family"
        ? { viewSchedule: true, viewHistory: false, editMedications: false, editAppointments: false, viewPrivateAppointments: false, receiveAlerts: true, manageCircle: false }
        : { viewSchedule: false, viewHistory: false, editMedications: false, editAppointments: false, viewPrivateAppointments: false, receiveAlerts: true, manageCircle: false },
      createdBy: context.memberId, usedAt: null, createdAt: Timestamp.fromMillis(now), expiresAt,
    });
    const eventRef = db.collection("events").doc();
    transaction.create(eventRef, {
      circleId: context.circleId, type: "member.invited", actor: actorFor(context.memberId, context.member),
      subject: { kind: "invite", id: inviteRef.id }, data: { role: input.role },
      visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: Timestamp.fromMillis(now),
    });
  });
  return Response.json({ invite: { code, role: input.role, expiresAt: expiresAt.toDate().toISOString() } }, { status: 201, headers: { "Cache-Control": "no-store" } });
});
