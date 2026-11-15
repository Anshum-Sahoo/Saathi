"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { cookieRequest } from "@/lib/firebase/client-auth";

type Medicine = { id: string; name: string; strength?: string; label: string; instructionText: string; times: string[]; daysOfWeek: number[]; startDate: string; endDate: string | null; status: string };
type Alert = { id: string; type: string; reason: string | null; description?: string; status: string; createdAt: string; claimedBy: { memberId: string; displayName: string } | null };
type RoutineDose = { id: string; snapshot: { name: string; strength: string | null }; scheduledAt: string; state: string; uiState: string };
type Memory = { id: string; type: string; at: string; actor?: { displayName?: string }; data?: Record<string, unknown> };
type Profile = { member: { id: string; displayName: string; role: string; permissions: Record<string, boolean> }; circle: { preferredName: string; timezone: string; status: string } };
type FormValues = Omit<Medicine, "id" | "status" | "times" | "daysOfWeek"> & { id?: string; times: string; daysOfWeek: number[] };

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const blankForm = (timezone: string): FormValues => ({ name: "", strength: "", label: "", instructionText: "", times: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startDate: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), endDate: null });

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    "medication.created": "Medicine added", "medication.updated": "Medicine details changed", "medication.paused": "Medicine paused",
    "medication.discontinued": "Medicine discontinued", "dose.confirmed": "Elder reported the routine done", "dose.snoozed": "Elder asked for a later reminder",
    "help.requested": "Elder asked for help", "alert.claimed": "A helper took responsibility", "alert.resolved": "Alert marked as handled",
  };
  return labels[type] ?? type.replaceAll(".", " · ");
}

const reasonLabel: Record<string, string> = { medicine_finished: "Medicine finished", feel_unwell: "Feeling unwell", call_me: "Please call me", other: "Other" };

export function CareOperations() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [doses, setDoses] = useState<RoutineDose[]>([]);
  const [memory, setMemory] = useState<Memory[]>([]);
  const [form, setForm] = useState<FormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const current = await cookieRequest<Profile>("/api/me", "GET");
      setProfile(current);
      if (current.circle.status !== "active") return;
      const results = await Promise.allSettled([
        current.member.role === "elder" || current.member.permissions.viewSchedule
          ? cookieRequest<{ medications: Medicine[] }>("/api/medications", "GET")
          : Promise.resolve({ medications: [] as Medicine[] }),
        current.member.role === "elder" || current.member.permissions.receiveAlerts
          ? cookieRequest<{ alerts: Alert[] }>("/api/alerts", "GET")
          : Promise.resolve({ alerts: [] as Alert[] }),
        current.member.role === "elder" || current.member.permissions.viewSchedule
          ? cookieRequest<{ doses: RoutineDose[] }>("/api/doses?date=today", "GET")
          : Promise.resolve({ doses: [] as RoutineDose[] }),
        current.member.permissions.viewHistory || current.member.role === "elder"
          ? cookieRequest<{ items: Memory[] }>("/api/memory?limit=12", "GET")
          : Promise.resolve({ items: [] as Memory[] }),
      ]);
      if (results[0].status === "fulfilled") setMedicines(results[0].value.medications);
      if (results[1].status === "fulfilled") setAlerts(results[1].value.alerts);
      if (results[2].status === "fulfilled") setDoses(results[2].value.doses);
      if (results[3].status === "fulfilled") setMemory(results[3].value.items);
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") setError(failure.reason instanceof Error ? failure.reason.message : "Some care information could not be loaded.");
      else setError("");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Sign in to continue."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function saveMedicine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setWorking(true); setError(""); setNotice("");
    try {
      const body = { ...form, times: form.times.split(",").map((value) => value.trim()).filter(Boolean) };
      if (form.id) {
        const { id, ...patch } = body;
        await cookieRequest(`/api/medications/${encodeURIComponent(id!)}`, "PATCH", patch);
        setNotice("Medicine details saved.");
      } else {
        await cookieRequest("/api/medications", "POST", body);
        setNotice("Medicine added to the schedule.");
      }
      setForm(null); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Medicine could not be saved."); }
    finally { setWorking(false); }
  }

  async function pauseMedicine(medicine: Medicine, status: "paused" | "discontinued") {
    setWorking(true); setError(""); setNotice("");
    try {
      await cookieRequest(`/api/medications/${encodeURIComponent(medicine.id)}/pause`, "POST", { status });
      setNotice(status === "paused" ? "Medicine paused. Its past routine records remain in Care Memory." : "Medicine discontinued. Its past routine records remain in Care Memory.");
      await load();
    } catch (pauseError) { setError(pauseError instanceof Error ? pauseError.message : "That change could not be saved."); }
    finally { setWorking(false); }
  }

  async function claim(alert: Alert) {
    setWorking(true); setError(""); setNotice("");
    try {
      await cookieRequest(`/api/alerts/${encodeURIComponent(alert.id)}/claim`, "POST", { requestId: crypto.randomUUID() });
      setNotice("You’re on it. The care circle can see you took responsibility."); await load();
    } catch (claimError) { setError(claimError instanceof Error ? claimError.message : "This alert could not be claimed."); await load(); }
    finally { setWorking(false); }
  }

  async function resolve(alert: Alert, outcome: string) {
    setWorking(true); setError(""); setNotice("");
    try {
      await cookieRequest(`/api/alerts/${encodeURIComponent(alert.id)}/resolve`, "POST", { outcome, requestId: crypto.randomUUID() });
      setNotice("The alert was marked as handled and added to Care Memory."); await load();
    } catch (resolveError) { setError(resolveError instanceof Error ? resolveError.message : "The alert could not be resolved."); }
    finally { setWorking(false); }
  }

  if (loading) return <div className="page-wrap"><p role="status">Loading care schedule…</p></div>;
  if (!profile) return null;
  const canEdit = profile.member.role === "elder" || profile.member.permissions.editMedications;
  const canView = profile.member.role === "elder" || profile.member.permissions.viewSchedule;
  const canReceive = profile.member.role === "elder" || profile.member.permissions.receiveAlerts;

  return <section className="page-wrap care-operations" aria-label="Medication schedule, help alerts, and Care Memory">
    <div className="screen-heading"><div><span className="eyebrow">Care, shared with care</span><h1>Today’s care</h1><p>Changes and check-ins are shared with the people the elder has approved.</p></div><button type="button" className="button button-secondary" onClick={() => void load()}>Refresh</button></div>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="success-note">{notice}</p>}
    {profile.circle.status !== "active" && <section className="surface surface-pad"><h2>Waiting for consent</h2><p>The medication schedule opens after the elder accepts care sharing.</p></section>}
    {profile.circle.status === "active" && <div className="care-operations-grid">
      {canView && <section className="surface surface-pad" aria-labelledby="medicines-title">
        <div className="surface-heading"><div><h2>Today’s routine</h2><p>Responses are self-reported by the elder.</p></div></div>
        {!doses.length && <p className="quiet-placeholder">No doses are scheduled for today.</p>}
        <div className="medicine-list">{doses.map((dose) => <div className="medicine-row" key={dose.id}><div><strong>{dose.snapshot.name}{dose.snapshot.strength ? ` · ${dose.snapshot.strength}` : ""}</strong><span>{new Date(dose.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: profile.circle.timezone })} · {dose.uiState === "confirmed" ? "Elder reported done" : dose.uiState === "snoozed" ? "Snoozed" : dose.uiState === "unconfirmed" ? "No response yet" : dose.uiState}</span></div></div>)}</div>
        <div className="surface-heading"><div><h2 id="medicines-title">Medicines</h2><p>Times use {profile.circle.timezone}.</p></div>{canEdit && <button type="button" className="button button-primary" disabled={working || medicines.length >= 20} onClick={() => setForm(blankForm(profile.circle.timezone))}>Add medicine</button>}</div>
        {form && <form className="medicine-form" onSubmit={(event) => void saveMedicine(event)}>
          <h3>{form.id ? "Edit medicine" : "Add a medicine"}</h3>
          <label>Medicine name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Strength, if provided<input maxLength={60} value={form.strength ?? ""} onChange={(e) => setForm({ ...form, strength: e.target.value })} /></label>
          <label>Instructions entered by caregiver<input maxLength={240} value={form.instructionText} onChange={(e) => setForm({ ...form, instructionText: e.target.value })} /></label>
          <label>Simple note for the elder<input required maxLength={160} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
          <label>Scheduled times, 24-hour clock<input required aria-describedby="times-help" value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} /><span id="times-help" className="field-note">Separate times with commas, for example 09:00, 20:30.</span></label>
          <fieldset><legend>Days</legend><div className="weekday-list">{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={form.daysOfWeek.includes(index)} onChange={() => setForm({ ...form, daysOfWeek: form.daysOfWeek.includes(index) ? form.daysOfWeek.filter((value) => value !== index) : [...form.daysOfWeek, index].sort() })} />{day}</label>)}</div></fieldset>
          <div className="medicine-date-row"><label>Start date<input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label><label>End date (optional)<input type="date" value={form.endDate ?? ""} onChange={(e) => setForm({ ...form, endDate: e.target.value || null })} /></label></div>
          <div className="circle-actions"><button className="button button-primary" disabled={working || !form.daysOfWeek.length}>Save medicine</button><button type="button" className="button button-secondary" onClick={() => setForm(null)}>Cancel</button></div>
        </form>}
        {medicines.length === 0 && <div className="quiet-placeholder"><p>No medicines have been added yet. A caregiver can enter the schedule from the elder’s instructions.</p></div>}
        <div className="medicine-list">{medicines.map((medicine) => <article className="medicine-row" key={medicine.id}>
          <div><strong>{medicine.name}{medicine.strength ? ` · ${medicine.strength}` : ""}</strong><span>{medicine.times.join(" · ")} · {medicine.daysOfWeek.length === 7 ? "Every day" : medicine.daysOfWeek.map((day) => weekdays[day]).join(", ")}</span><p>{medicine.label}{medicine.instructionText ? ` — ${medicine.instructionText}` : ""}</p>{medicine.status !== "active" && <span className="status-pill">{medicine.status}</span>}</div>
          {canEdit && medicine.status === "active" && <div className="circle-actions"><button type="button" className="text-action" disabled={working} onClick={() => setForm({ ...medicine, times: medicine.times.join(", ") })}>Edit</button><button type="button" className="text-action" disabled={working} onClick={() => void pauseMedicine(medicine, "paused")}>Pause</button><button type="button" className="text-action" disabled={working} onClick={() => void pauseMedicine(medicine, "discontinued")}>Discontinue</button></div>}
        </article>)}</div>
        <p className="care-safety-note">SAATHI records the schedule entered by your care circle. It does not recommend medicines or change instructions.</p>
      </section>}
      {canReceive && <section className="surface surface-pad" aria-labelledby="alerts-title">
        <div className="surface-heading"><div><h2 id="alerts-title">Care alerts</h2><p>A named person can take responsibility.</p></div></div>
        {!alerts.length && <div className="quiet-placeholder"><p>No open care alerts.</p></div>}
        <div className="alert-list">{alerts.map((alert) => <article className="request-card" key={alert.id}>
          <div className="request-top"><div className="request-symbol" aria-hidden="true">!</div><div><h3>{alert.type === "help_request" ? "Asked for help" : "Routine needs a check-in"}</h3><p>{alert.reason ? reasonLabel[alert.reason] : "No response has been recorded."}{alert.description ? ` · ${alert.description}` : ""}</p></div></div>
          <p className="request-meta">Created {new Date(alert.createdAt).toLocaleString()}</p>
          {alert.status === "claimed" && <p className="alert-owner" role="status">{alert.claimedBy?.displayName ?? "A helper"} is on it.</p>}
          {alert.status === "open" && <button type="button" className="button button-primary" disabled={working} onClick={() => void claim(alert)}>I’ve got it — I’m checking on them</button>}
          {alert.status === "claimed" && alert.claimedBy?.memberId === profile.member.id && <label className="resolve-row">How was it handled?<select defaultValue="" disabled={working} onChange={(event) => { if (event.target.value) void resolve(alert, event.target.value); }}><option value="" disabled>Choose an outcome</option><option value="spoke_with_elder">Spoke with them</option><option value="visited_in_person">Visited in person</option><option value="medicine_arranged">Medicine arranged</option><option value="other">Other</option></select></label>}
        </article>)}</div>
        <p className="care-safety-note">SAATHI is not an emergency-response service. For an emergency, contact local emergency services or a trusted person directly.</p>
      </section>}
      {memory.length > 0 && <section className="surface surface-pad" aria-labelledby="care-memory-title"><h2 id="care-memory-title">Care Memory</h2><div className="memory-list">{memory.map((event) => <div className="memory-item" key={event.id}><div><strong>{eventLabel(event.type)}</strong><span>{event.actor?.displayName ?? "Care circle"} · {new Date(event.at).toLocaleString()}</span></div></div>)}</div></section>}
    </div>}
  </section>;
}
