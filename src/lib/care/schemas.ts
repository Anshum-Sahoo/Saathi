import { z } from "zod";

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
});

export const medicationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  strength: z.string().trim().max(60).optional().default(""),
  instructionText: z.string().trim().max(240).default(""),
  label: z.string().trim().min(1).max(160),
  times: z.array(clock).min(1).max(8).refine((values) => new Set(values).size === values.length),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine((values) => new Set(values).size === values.length),
  startDate: date,
  endDate: date.nullable().default(null),
}).strict().refine((value) => !value.endDate || value.endDate >= value.startDate, { path: ["endDate"], message: "End date must be on or after the start date." });

export const medicationPatchSchema = medicationSchema.partial().strict();
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
