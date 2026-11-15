import { z } from "zod";

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
});

const medicationFields = {
  name: z.string().trim().min(1).max(100),
  strength: z.string().trim().max(60).optional().default(""),
  instructionText: z.string().trim().max(240).default(""),
  label: z.string().trim().min(1).max(160),
  times: z.array(clock).min(1).max(8).refine((values) => new Set(values).size === values.length),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine((values) => new Set(values).size === values.length),
  startDate: date,
  endDate: date.nullable().default(null),
};

export const medicationSchema = z.object(medicationFields).strict().refine((value) => !value.endDate || value.endDate >= value.startDate, { path: ["endDate"], message: "End date must be on or after the start date." });

export const medicationPatchSchema = z.object(medicationFields).partial().strict();
export const signalSchema = z.object({ signal: z.enum(["ok", "not_yet"]), requestId: z.string().uuid() }).strict();
export const helpSchema = z.object({
  reason: z.enum(["medicine_finished", "feel_unwell", "call_me", "other"]),
  description: z.string().trim().max(140).optional().default(""),
  doseId: z.string().regex(/^[A-Za-z0-9_-]{1,180}$/).optional(),
  requestId: z.string().uuid(),
}).strict();
export const claimSchema = z.object({ requestId: z.string().uuid() }).strict();
export const resolveSchema = z.object({
  outcome: z.enum(["spoke_with_elder", "visited_in_person", "medicine_arranged", "other"]),
  requestId: z.string().uuid(),
}).strict();

const appointmentFields = {
  doctorName: z.string().trim().min(1).max(120),
  specialization: z.string().trim().max(100).default(""),
  clinic: z.string().trim().min(1).max(140),
  date: date,
  time: clock,
  purpose: z.string().trim().min(1).max(240),
  notes: z.string().trim().max(500).default(""),
  assignedMemberId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/).nullable().default(null),
};
export const appointmentSchema = z.object(appointmentFields).strict();
export const appointmentPatchSchema = z.object({
  doctorName: appointmentFields.doctorName.optional(),
  specialization: appointmentFields.specialization.optional(),
  clinic: appointmentFields.clinic.optional(),
  date: date.optional(),
  time: clock.optional(),
  purpose: appointmentFields.purpose.optional(),
  notes: appointmentFields.notes.optional(),
  assignedMemberId: appointmentFields.assignedMemberId.optional(),
  status: z.enum(["cancelled", "completed"]).optional(),
}).strict();
