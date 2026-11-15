export type MedicationSchedule = {
  id: string;
  name: string;
  strength?: string;
  label: string;
  instructionText: string;
  times: string[];
  daysOfWeek: number[];
  startDate: string;
  endDate: string | null;
};

type LocalClock = { year: number; month: number; day: number; hour: number; minute: number };

function localClock(date: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

export function localDateInZone(now: Date, timeZone: string): string {
  const { year, month, day } = localClock(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function localTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = localClock(new Date(guess), timeZone);
    guess += target - Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  }
  return new Date(guess);
}

export function dosesForDate(medications: MedicationSchedule[], date: string, timeZone: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return medications
    .filter((medication) => date >= medication.startDate && (!medication.endDate || date <= medication.endDate) && medication.daysOfWeek.includes(weekday))
    .flatMap((medication) => medication.times.map((time) => {
      const scheduledAt = localTimeToUtc(date, time, timeZone);
      return {
        id: `med_${medication.id}_${date.replaceAll("-", "")}T${time.replace(":", "")}`,
        medicationId: medication.id,
        scheduledAt,
        snapshot: { name: medication.name, strength: medication.strength ?? null, label: medication.label, instructionText: medication.instructionText },
      };
    }));
}

export function doseUiState(dose: { state: string; scheduledAt: Date; snoozedUntil?: Date }, now: Date) {
  if (["confirmed", "resolved", "cancelled"].includes(dose.state)) return dose.state;
  if (dose.state === "needs_help") return "needs_help";
  if (dose.state === "snoozed" && dose.snoozedUntil && dose.snoozedUntil > now) return "snoozed";
  return dose.scheduledAt <= now ? "unconfirmed" : "upcoming";
}
