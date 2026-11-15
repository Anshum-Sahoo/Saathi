export type DemoNotification = { id: string; title: string; body: string; at: number; read: boolean };
export type DemoAlert = { id: string; status: "open" | "claimed" | "resolved"; owner: string | null };
export type DemoMedication = { id: string; name: string; strength: string; note: string };
export type DemoAppointment = { id: string; doctor: string; at: number; assigned: string; acknowledged: boolean; status: "scheduled" | "cancelled" | "completed"; version: number };
export type DemoEvent = { id: string; type: string; actor: string; at: number };
export type DemoState = { now: number; doseState: "unconfirmed" | "snoozed" | "confirmed"; snoozedUntil: number | null; notifications: DemoNotification[]; medications: DemoMedication[]; alert: DemoAlert; appointments: DemoAppointment[]; events: DemoEvent[] };

function addEvent(state: DemoState, type: string, actor: string): DemoEvent[] {
  return [...state.events, { id: `event-${state.events.length + 1}`, type, actor, at: state.now }];
}

export function demoSeed(now = Date.now()): DemoState {
  return { now, doseState: "unconfirmed", snoozedUntil: null, notifications: [], medications: [{ id: "fictional-med-1", name: "Vitamin D", strength: "1000 IU", note: "After breakfast" }], alert: { id: "fictional-help-1", status: "open", owner: null }, appointments: [{ id: "fictional-appointment-1", doctor: "Dr. Meera Rao", at: now + 25 * 60 * 60_000, assigned: "Maya (family)", acknowledged: false, status: "scheduled", version: 1 }], events: [] };
}

export function saveDemoMedication(state: DemoState, input: Omit<DemoMedication, "id"> & { id?: string }): DemoState {
  if (input.id && state.medications.some((item) => item.id === input.id)) {
    return { ...state, medications: state.medications.map((item) => item.id === input.id ? { ...input, id: item.id } : item), events: addEvent(state, "medication.updated", "Ravi (caregiver)") };
  }
  const id = `fictional-med-${state.medications.length + 1}`;
  return { ...state, medications: [...state.medications, { ...input, id }], events: addEvent(state, "medication.created", "Ravi (caregiver)") };
}

export function recordDemoDose(state: DemoState, signal: "confirmed" | "snoozed"): DemoState {
  return { ...state, doseState: signal, snoozedUntil: signal === "snoozed" ? state.now + 15 * 60_000 : null, events: addEvent(state, signal === "confirmed" ? "dose.confirmed" : "dose.snoozed", "Anita (elder)") };
}

export function advanceDemo(state: DemoState, milliseconds: number): DemoState {
  const now = state.now + milliseconds;
  const notifications = [...state.notifications];
  const add = (id: string, title: string, body: string, at: number) => { if (!notifications.some((item) => item.id === id)) notifications.push({ id, title, body, at, read: false }); };
  if (state.doseState !== "confirmed" && state.doseState !== "snoozed" && now >= state.now) for (const med of state.medications) add(`dose-due-${med.id}`, "Medicine routine is due", "A dose is ready for a check-in.", now);
  if (state.doseState === "snoozed" && state.snoozedUntil !== null && now >= state.snoozedUntil) for (const med of state.medications) add(`dose-snooze-${med.id}-${state.snoozedUntil}`, "Later reminder is due", "The elder asked to be reminded again.", now);
  for (const appt of state.appointments) if (appt.status === "scheduled") for (const hours of [24, 1]) {
    const due = appt.at - hours * 60 * 60_000;
    if (state.now < due && now >= due) add(`appointment-${appt.id}-v${appt.version}-${hours}h`, "Appointment coming up", `${appt.doctor} in about ${hours} hour(s).`, due);
  }
  return { ...state, now, notifications };
}

export function claimDemoAlert(state: DemoState, member: string): DemoState {
  if (state.alert.status !== "open") return state;
  return { ...state, alert: { ...state.alert, status: "claimed", owner: member }, events: addEvent(state, "alert.claimed", member) };
}

export function resolveDemoAlert(state: DemoState): DemoState {
  return state.alert.status === "claimed" ? { ...state, alert: { ...state.alert, status: "resolved" }, events: addEvent(state, "alert.resolved", state.alert.owner ?? "Caregiver") } : state;
}

export function requestDemoHelp(state: DemoState): DemoState {
  if (state.alert.status === "claimed") return state;
  const alert = state.alert.status === "resolved" ? { id: `fictional-help-${state.now}`, status: "open" as const, owner: null } : state.alert;
  const id = `help-request-${alert.id}`;
  if (state.notifications.some((item) => item.id === id)) return { ...state, alert };
  return { ...state, alert, notifications: [...state.notifications, { id, title: "Help requested", body: "Anita asked her care circle for help.", at: state.now, read: false }], events: addEvent(state, "help.requested", "Anita (elder)") };
}

export function createDemoAppointment(state: DemoState, input: Pick<DemoAppointment, "doctor" | "at" | "assigned">): DemoState {
  const id = `fictional-appointment-${state.appointments.length + 1}`;
  return { ...state, appointments: [...state.appointments, { ...input, id, acknowledged: false, status: "scheduled", version: 1 }], events: addEvent(state, "appointment.created", "Ravi (caregiver)") };
}

export function updateDemoAppointment(state: DemoState, id: string, change: Partial<Pick<DemoAppointment, "at" | "doctor" | "assigned" | "status">>): DemoState {
  const current = state.appointments.find((appointment) => appointment.id === id);
  if (!current) return state;
  const type = change.status === "cancelled" ? "appointment.cancelled" : change.status === "completed" ? "appointment.completed" : current.assigned !== change.assigned ? "appointment.assigned" : "appointment.updated";
  return { ...state, appointments: state.appointments.map((appointment) => appointment.id === id ? { ...appointment, ...change, acknowledged: false, version: appointment.version + 1 } : appointment), events: addEvent(state, type, "Ravi (caregiver)") };
}

export function acknowledgeDemoAppointment(state: DemoState, id: string): DemoState {
  const current = state.appointments.find((appointment) => appointment.id === id);
  if (!current || current.status !== "scheduled" || current.acknowledged) return state;
  return { ...state, appointments: state.appointments.map((appointment) => appointment.id === id ? { ...appointment, acknowledged: true } : appointment), events: addEvent(state, "appointment.acknowledged", current.assigned) };
}
