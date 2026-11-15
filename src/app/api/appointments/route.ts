import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { appointmentSchema } from "@/lib/care/schemas";
import { ensureActiveCircle, eventRecord } from "@/lib/care/firestore";
import { localTimeToUtc } from "@/lib/care/schedule";
import { inAppNotification, notificationId } from "@/lib/notifications/server";
import { ApiError, apiRoute, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appointmentDto(id: string, data: DocumentData) {
  return {
    id, doctorName: data.doctorName, specialization: data.specialization ?? "", clinic: data.clinic,
    startsAt: data.startsAt.toDate().toISOString(), timezone: data.timezone, purpose: data.purpose, notes: data.notes ?? "",
    assignedMemberId: data.assignedMemberId ?? null, assignedMemberName: data.assignedMemberName ?? null,
    assignedAcknowledgedAt: data.assignedAcknowledgedAt?.toDate().toISOString() ?? null,
    status: data.status, version: data.version, createdBy: data.createdBy,
  };
}

export const GET = apiRoute(async (request) => {
  const context = await requireAction(request, "viewSchedule");
  ensureActiveCircle(context);
  const snapshot = await requireFirestore().collection("appointments").where("circleId", "==", context.circleId)
    .where("startsAt", ">=", Timestamp.now()).orderBy("startsAt", "asc").limit(50).get();
  const appointments = snapshot.docs.filter((doc) => doc.data().status === "scheduled").map((doc) => appointmentDto(doc.id, doc.data()));
  return Response.json({ appointments, timezone: context.circle.timezone }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireAction(request, "editAppointments");
  ensureActiveCircle(context);
  if (!["caregiver", "family"].includes(context.member.role)) throw new ApiError(403, "FORBIDDEN", "Only an authorized caregiver or family member can add appointments.");
  const input = await readJson(request, appointmentSchema);
  const startsAt = localTimeToUtc(input.date, input.time, context.circle.timezone);
  if (startsAt.getTime() <= Date.now()) throw new ApiError(400, "VALIDATION_ERROR", "Choose a future appointment time.");
  const db = requireFirestore();
  const appointmentRef = db.collection("appointments").doc();
  const eventRef = db.collection("events").doc();
  const assignedRef = input.assignedMemberId ? db.collection("members").doc(input.assignedMemberId) : null;
  const notificationRef = input.assignedMemberId ? db.collection("notifications").doc(notificationId("appointment_assigned", appointmentRef.id, "v1", input.assignedMemberId)) : null;
  let assignedMemberName: string | null = null;
  await db.runTransaction(async (transaction) => {
    const [assigned, existingNotification] = await Promise.all([
      assignedRef ? transaction.get(assignedRef) : Promise.resolve(null),
      notificationRef ? transaction.get(notificationRef) : Promise.resolve(null),
    ]);
    if (assignedRef) {
      const member = assigned?.data();
      if (!assigned?.exists || member?.circleId !== context.circleId || member.status !== "active" || !["family", "caregiver"].includes(member.role)) {
        throw new ApiError(400, "VALIDATION_ERROR", "Choose an active family member or caregiver in this circle.");
      }
      assignedMemberName = member.displayName;
    }
    transaction.create(appointmentRef, {
      circleId: context.circleId, ...input, startsAt: Timestamp.fromDate(startsAt), timezone: context.circle.timezone,
      assignedMemberName, assignedAcknowledgedAt: null, status: "scheduled", createdBy: context.memberId,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), version: 1,
    });
    transaction.create(eventRef, eventRecord(context, "appointment.created", { kind: "appointment", id: appointmentRef.id }, { label: "Appointment scheduled" }));
    if (input.assignedMemberId && notificationRef && !existingNotification?.exists) transaction.create(notificationRef, inAppNotification({
      circleId: context.circleId, memberId: input.assignedMemberId, category: "appointment_assigned", titleKey: "notification.assignment.title",
      bodyKey: "notification.assignment.body", params: { doctor: input.doctorName }, recordType: "appointment", recordId: appointmentRef.id, reminderVersion: 1,
    }));
  });
  return Response.json({ appointment: { id: appointmentRef.id, ...input, startsAt: startsAt.toISOString(), timezone: context.circle.timezone, assignedMemberName, assignedAcknowledgedAt: null, status: "scheduled", version: 1 } }, { status: 201, headers: { "Cache-Control": "no-store" } });
});
