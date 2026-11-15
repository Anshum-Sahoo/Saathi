import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { appointmentPatchSchema } from "@/lib/care/schemas";
import { ensureActiveCircle, ensureDocumentId, eventRecord } from "@/lib/care/firestore";
import { localDateInZone, localTimeToUtc } from "@/lib/care/schedule";
import { inAppNotification, notificationId } from "@/lib/notifications/server";
import { ApiError, apiRoute, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = apiRoute(async (request: Request, route: RouteContext) => {
  requireOrigin(request);
  const context = await requireAction(request, "editAppointments");
  ensureActiveCircle(context);
  const { id } = await route.params;
  ensureDocumentId(id);
  const input = await readJson(request, appointmentPatchSchema);
  if (!Object.keys(input).length) throw new ApiError(400, "VALIDATION_ERROR", "Add at least one change.");
  const db = requireFirestore();
  const appointmentRef = db.collection("appointments").doc(id);
  const eventRef = db.collection("events").doc();
  const assignmentEventRef = db.collection("events").doc();
  let result: Record<string, unknown> = {};
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    const current = snapshot.data();
    if (!snapshot.exists || current?.circleId !== context.circleId) throw new ApiError(404, "NOT_FOUND", "This appointment could not be found.");
    if (current.status !== "scheduled") throw new ApiError(409, "INVALID_STATE", "Only a scheduled appointment can be changed.");
    const changingAssignment = Object.hasOwn(input, "assignedMemberId") && input.assignedMemberId !== current.assignedMemberId;
    const assignedRef = changingAssignment && input.assignedMemberId ? db.collection("members").doc(input.assignedMemberId) : null;
    const assignedSnapshot = assignedRef ? await transaction.get(assignedRef) : null;
    let assignedMemberName = current.assignedMemberName ?? null;
    if (assignedRef) {
      const member = assignedSnapshot?.data();
      if (!assignedSnapshot?.exists || member?.circleId !== context.circleId || member.status !== "active" || !["family", "caregiver"].includes(member.role)) {
        throw new ApiError(400, "VALIDATION_ERROR", "Choose an active family member or caregiver in this circle.");
      }
      assignedMemberName = member.displayName;
    } else if (changingAssignment) assignedMemberName = null;

    let startsAt = current.startsAt.toDate() as Date;
    if (input.date || input.time) {
      const date = input.date ?? localDateInZone(startsAt, context.circle.timezone);
      const time = input.time ?? new Intl.DateTimeFormat("en-GB", { timeZone: context.circle.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(startsAt);
      startsAt = localTimeToUtc(date, time, context.circle.timezone);
      if (startsAt.getTime() <= Date.now()) throw new ApiError(400, "VALIDATION_ERROR", "Choose a future appointment time.");
    }
    const version = Number(current.version ?? 1) + 1;
    const update: Record<string, unknown> = { ...input, startsAt: Timestamp.fromDate(startsAt), updatedAt: FieldValue.serverTimestamp(), updatedBy: context.memberId, version };
    delete update.date;
    delete update.time;
    if (changingAssignment) {
      update.assignedMemberName = assignedMemberName;
      update.assignedAcknowledgedAt = null;
    }
    if (input.status) update.nextReminderAt = FieldValue.delete();
    const newNotificationRef = input.assignedMemberId && changingAssignment
      ? db.collection("notifications").doc(notificationId("appointment_assigned", id, `v${version}`, input.assignedMemberId)) : null;
    const existingNotification = newNotificationRef ? await transaction.get(newNotificationRef) : null;
    transaction.update(appointmentRef, update);
    transaction.create(eventRef, eventRecord(context, input.status === "cancelled" ? "appointment.cancelled" : input.status === "completed" ? "appointment.completed" : "appointment.updated", { kind: "appointment", id }, { label: input.status ? `Appointment ${input.status}` : "Appointment details changed" }));
    if (changingAssignment) transaction.create(assignmentEventRef, eventRecord(context, "appointment.assigned", { kind: "appointment", id }, { label: input.assignedMemberId ? "Appointment responsibility assigned" : "Appointment responsibility removed" }));
    if (newNotificationRef && !existingNotification?.exists) transaction.create(newNotificationRef, inAppNotification({
      circleId: context.circleId, memberId: input.assignedMemberId!, category: "appointment_assigned", titleKey: "notification.assignment.title",
      bodyKey: "notification.assignment.body", params: { doctor: String(input.doctorName ?? current.doctorName) }, recordType: "appointment", recordId: id, reminderVersion: version,
    }));
    result = { ...current, ...input, startsAt: startsAt.toISOString(), timezone: context.circle.timezone, assignedMemberId: changingAssignment ? input.assignedMemberId ?? null : current.assignedMemberId ?? null,
      assignedMemberName, assignedAcknowledgedAt: changingAssignment ? null : current.assignedAcknowledgedAt?.toDate().toISOString() ?? null, version, id };
  });
  return Response.json({ appointment: result }, { headers: { "Cache-Control": "no-store" } });
});
