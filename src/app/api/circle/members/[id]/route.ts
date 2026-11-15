import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { requireContext, requireElevatedElder } from "@/lib/auth/guard";
import { isAllowedPermissionSet } from "@/lib/auth/permissions";
import type { MemberPermissions, MemberRecord } from "@/lib/auth/types";
import { actorFor } from "@/lib/server/audit";
import { ApiError, apiRoute, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const permissionsSchema = z.object({
  viewSchedule: z.boolean(), viewHistory: z.boolean(), editMedications: z.boolean(),
  editAppointments: z.boolean(), viewPrivateAppointments: z.boolean(), receiveAlerts: z.boolean(), manageCircle: z.boolean(),
}).strict();
const patchSchema = z.object({ permissions: permissionsSchema }).strict();

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = async (request: Request, route: RouteContext) => apiRoute(async (req) => {
  requireOrigin(req);
  const context = await requireContext(req);
  requireElevatedElder(context);
  const { id } = await route.params;
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(id)) throw new ApiError(404, "NOT_FOUND", "This member could not be found.");
  const { permissions } = await readJson(req, patchSchema);
  const db = requireFirestore();
  const memberRef = db.collection("members").doc(id);
  const eventRef = db.collection("events").doc();
  const now = Timestamp.now();
  let target: MemberRecord | undefined;
  await db.runTransaction(async (transaction) => {
    const memberSnapshot = await transaction.get(memberRef);
    if (!memberSnapshot.exists || memberSnapshot.data()?.circleId !== context.circleId || memberSnapshot.data()?.status !== "active") {
      throw new ApiError(404, "NOT_FOUND", "This member could not be found.");
    }
    target = memberSnapshot.data() as MemberRecord;
    if (target.role === "elder" || !isAllowedPermissionSet(target.role, permissions as MemberPermissions)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Those permissions are not available for this role.");
    }
    transaction.update(memberRef, { permissions, version: (target.version ?? 0) + 1 });
    transaction.create(eventRef, {
      circleId: context.circleId, type: "permissions.changed", actor: actorFor(context.memberId, context.member),
      subject: { kind: "member", id }, data: {}, visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
  });
  return Response.json({ member: { id, permissions } });
})(request);

export const DELETE = async (request: Request, route: RouteContext) => apiRoute(async (req) => {
  requireOrigin(req);
  const context = await requireContext(req);
  const { id } = await route.params;
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(id) || id === context.memberId) throw new ApiError(404, "NOT_FOUND", "This member could not be found.");
  if (context.member.role === "elder") requireElevatedElder(context);
  else if (context.member.role !== "caregiver" || !context.member.permissions.manageCircle) throw new ApiError(403, "FORBIDDEN", "You do not have access to remove members.");
  const db = requireFirestore();
  const memberRef = db.collection("members").doc(id);
  const eventRef = db.collection("events").doc();
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const memberSnapshot = await transaction.get(memberRef);
    if (!memberSnapshot.exists || memberSnapshot.data()?.circleId !== context.circleId || memberSnapshot.data()?.status !== "active" || memberSnapshot.data()?.role === "elder") {
      throw new ApiError(404, "NOT_FOUND", "This member could not be found.");
    }
    const sessions = await transaction.get(db.collection("sessions").where("memberId", "==", id).limit(50));
    transaction.update(memberRef, { status: "removed", removedAt: now, version: (memberSnapshot.data()?.version ?? 0) + 1 });
    for (const session of sessions.docs) transaction.delete(session.ref);
    transaction.create(eventRef, {
      circleId: context.circleId, type: "member.removed", actor: actorFor(context.memberId, context.member),
      subject: { kind: "member", id }, data: {}, visibleToRoles: ["elder", "caregiver", "family", "emergency_contact"], createdAt: now,
    });
  });
  return Response.json({ ok: true });
})(request);
