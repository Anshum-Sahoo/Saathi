import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireAction } from "@/lib/auth/guard";
import { alertRecipients, ensureActiveCircle } from "@/lib/care/firestore";
import { inAppNotification, notificationId } from "@/lib/notifications/server";
import { ApiError, apiRoute, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireAction(request, "editMedications");
  if (context.member.role !== "caregiver") throw new ApiError(403, "FORBIDDEN", "A caregiver can check reminders for this circle.");
  ensureActiveCircle(context);
  const db = requireFirestore();
  const now = Timestamp.now();
  const recipients = await alertRecipients(db, context.circleId);
  const elders = await db.collection("members").where("circleId", "==", context.circleId).where("role", "==", "elder").where("status", "==", "active").limit(1).get();
  const doseRecipients = [...recipients, ...elders.docs.map((doc) => doc.id)];
  const dueDoses = await db.collection("doses").where("circleId", "==", context.circleId)
    .where("scheduledAt", "<=", now).orderBy("scheduledAt", "asc").limit(100).get();
  let dueCount = 0;
  let snoozeCount = 0;

  for (const candidate of dueDoses.docs) {
    const doseRef = candidate.ref;
    const doseData = candidate.data();
    const medicationRef = db.collection("medications").doc(String(doseData.medicationId));
    const isSnooze = doseData.state === "snoozed" && doseData.snoozedUntil?.toMillis() <= now.toMillis();
    const isDue = ["scheduled", "reminded", "unconfirmed"].includes(doseData.state);
    if (!isSnooze && !isDue) continue;
    const eventRef = db.collection("events").doc(`${isSnooze ? "dose_snooze_due" : "dose_due"}_${candidate.id}_${doseData.snoozeCount ?? 0}`);
    const notificationRefs = doseRecipients.map((memberId) => db.collection("notifications").doc(notificationId("dose", candidate.id, String(doseData.snoozeCount ?? 0), memberId)));
    const created = await db.runTransaction(async (transaction) => {
      const [doseSnapshot, medicationSnapshot, eventSnapshot, ...notifications] = await Promise.all([
        transaction.get(doseRef), transaction.get(medicationRef), transaction.get(eventRef), ...notificationRefs.map((ref) => transaction.get(ref)),
      ]);
      const dose = doseSnapshot.data();
      const medication = medicationSnapshot.data();
      if (!doseSnapshot.exists || dose?.circleId !== context.circleId || !medicationSnapshot.exists || medication?.circleId !== context.circleId || medication.status !== "active") return false;
      const snoozeReady = dose.state === "snoozed" && dose.snoozedUntil?.toMillis() <= now.toMillis();
      const dueReady = ["scheduled", "reminded", "unconfirmed"].includes(dose.state) && dose.scheduledAt.toMillis() <= now.toMillis();
      if ((isSnooze && !snoozeReady) || (!isSnooze && !dueReady)) return false;
      const eventType = isSnooze ? "dose.snooze_due" : "dose.reminder_due";
      let added = false;
      if (!eventSnapshot.exists) transaction.create(eventRef, {
        circleId: context.circleId, type: eventType,
        actor: { memberId: context.memberId, displayName: context.member.displayName, role: context.member.role },
        subject: { kind: "dose", id: candidate.id }, data: { state: isSnooze ? "snoozed" : "unconfirmed" },
        visibleToRoles: ["elder", "caregiver", "family"], createdAt: FieldValue.serverTimestamp(),
      });
      for (let index = 0; index < notificationRefs.length; index++) {
        if (notifications[index].exists) continue;
        added = true;
        transaction.create(notificationRefs[index], inAppNotification({
          circleId: context.circleId, memberId: doseRecipients[index], category: isSnooze ? "dose_snooze" : "dose_due",
          titleKey: isSnooze ? "notification.snooze.title" : "notification.dose.title",
          bodyKey: isSnooze ? "notification.snooze.body" : "notification.dose.body",
          params: { time: new Intl.DateTimeFormat(context.circle.language === "hi" ? "hi-IN" : "en-US", { timeZone: context.circle.timezone, hour: "numeric", minute: "2-digit" }).format(dose.scheduledAt.toDate()) },
          recordType: "dose", recordId: candidate.id,
        }));
      }
      return added;
    });
    if (created) { if (isSnooze) snoozeCount++; else dueCount++; }
  }

  const appointmentSnapshot = await db.collection("appointments").where("circleId", "==", context.circleId)
    .where("startsAt", ">", now).where("startsAt", "<=", Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60_000)).orderBy("startsAt", "asc").limit(100).get();
  let appointmentCount = 0;
  const memberSnapshot = await db.collection("members").where("circleId", "==", context.circleId).where("status", "==", "active").get();
  const members = new Map(memberSnapshot.docs.map((doc) => [doc.id, doc.data()]));
  for (const candidate of appointmentSnapshot.docs) {
    const appointment = candidate.data();
    if (appointment.status !== "scheduled") continue;
    const remaining = appointment.startsAt.toMillis() - now.toMillis();
    const phase = remaining <= 60 * 60_000 ? "1h" : "24h";
    const targets = new Set<string>([appointment.assignedMemberId, appointment.createdBy].filter((id): id is string => typeof id === "string"));
    for (const [id, member] of members) if (member.role === "caregiver" && member.permissions?.editAppointments) targets.add(id);
    const notificationRefs = [...targets].filter((id) => members.has(id)).map((id) => ({ memberId: id, ref: db.collection("notifications").doc(notificationId("appointment", candidate.id, `v${appointment.version}`, phase, id)) }));
    const eventRef = db.collection("events").doc(`appointment_reminder_${candidate.id}_v${appointment.version}_${phase}`);
    const created = await db.runTransaction(async (transaction) => {
      const [appointmentDoc, eventDoc, ...notifications] = await Promise.all([
        transaction.get(candidate.ref), transaction.get(eventRef), ...notificationRefs.map(({ ref }) => transaction.get(ref)),
      ]);
      const current = appointmentDoc.data();
      if (!appointmentDoc.exists || current?.circleId !== context.circleId || current.status !== "scheduled" || current.version !== appointment.version) return false;
      const currentRemaining = current.startsAt.toMillis() - now.toMillis();
      if (currentRemaining <= 0 || currentRemaining > 24 * 60 * 60_000 || (phase === "24h" && currentRemaining <= 60 * 60_000)) return false;
      let added = false;
      if (!eventDoc.exists) transaction.create(eventRef, {
        circleId: context.circleId, type: "appointment.reminder_created",
        actor: { memberId: context.memberId, displayName: context.member.displayName, role: context.member.role },
        subject: { kind: "appointment", id: candidate.id }, data: { reminder: phase },
        visibleToRoles: ["elder", "caregiver", "family"], createdAt: FieldValue.serverTimestamp(),
      });
      for (let index = 0; index < notificationRefs.length; index++) {
        if (notifications[index].exists) continue;
        added = true;
        transaction.create(notificationRefs[index].ref, inAppNotification({
          circleId: context.circleId, memberId: notificationRefs[index].memberId, category: "appointment",
          titleKey: "notification.appointment.title", bodyKey: "notification.appointment.body",
          params: { doctor: String(current.doctorName), phase }, recordType: "appointment", recordId: candidate.id, reminderVersion: current.version,
        }));
      }
      return added;
    });
    if (created) appointmentCount++;
  }
  return Response.json({ processedAt: now.toDate().toISOString(), doses: dueCount, snoozes: snoozeCount, appointments: appointmentCount }, { headers: { "Cache-Control": "no-store" } });
});
