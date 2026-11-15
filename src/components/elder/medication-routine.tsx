"use client";

import { useCallback, useEffect, useState } from "react";
import { cookieRequest } from "@/lib/firebase/client-auth";

type Dose = { id: string; medicationId: string; snapshot: { name: string; strength: string | null; label: string; instructionText: string }; scheduledAt: string; state: string; uiState: string; snoozedUntil?: string; snoozeCount: number };
type Schedule = { timezone: string; doses: Dose[] };
const reasons = [{ value: "medicine_finished", label: "Medicine finished" }, { value: "feel_unwell", label: "I feel unwell" }, { value: "call_me", label: "Please call someone" }, { value: "other", label: "Other" }];

export function MedicationRoutine() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [helpFor, setHelpFor] = useState("");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { setSchedule(await cookieRequest<Schedule>("/api/doses?date=today", "GET")); setError(""); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Today’s schedule could not be loaded."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function signal(dose: Dose, value: "ok" | "not_yet") {
    setWorking(dose.id); setError(""); setNotice("");
    try {
      await cookieRequest(`/api/doses/${encodeURIComponent(dose.id)}/signal`, "POST", { signal: value, requestId: crypto.randomUUID() });
      setNotice(value === "ok" ? "Your response was shared with your care circle. This is your report; SAATHI cannot verify medicine was taken." : "We’ll remind you again in 15 minutes.");
      await load();
    } catch (signalError) { setError(signalError instanceof Error ? signalError.message : "Your response could not be saved."); }
    finally { setWorking(""); }
  }

  async function askForHelp(dose?: Dose) {
    setWorking(dose?.id ?? "help"); setError(""); setNotice("");
    try {
      await cookieRequest("/api/help", "POST", { reason: reason[dose?.id ?? "general"] ?? "call_me", ...(reason[dose?.id ?? "general"] === "other" && description.trim() ? { description: description.trim() } : {}), ...(dose ? { doseId: dose.id } : {}), requestId: crypto.randomUUID() });
      setNotice("Your care circle has been told. SAATHI is not an emergency service. If this is an emergency, contact local emergency services or a trusted person now.");
      setHelpFor(""); setDescription(""); await load();
    } catch (helpError) { setError(helpError instanceof Error ? helpError.message : "Your request could not be sent."); }
    finally { setWorking(""); }
  }

  const time = (value: string) => new Intl.DateTimeFormat(undefined, { timeZone: schedule?.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
  const today = new Intl.DateTimeFormat(undefined, { timeZone: schedule?.timezone, weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return <section className="elder-routine" aria-labelledby="routine-title">
    <div className="elder-welcome"><div><span className="eyebrow">Your day, at your pace</span><h2 id="routine-title">Today’s medicine routine</h2><p>{today}{schedule ? ` · ${schedule.timezone}` : ""}</p></div><button type="button" className="button button-secondary" onClick={() => void load()}>Refresh</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-note" role="status">{notice}</p>}
    {!schedule && !error && <p role="status">Loading today’s routine…</p>}
    {schedule?.doses.length === 0 && <section className="surface surface-pad"><h3>No medicine scheduled today</h3><p>Your care circle can add or change the schedule. You can still ask them for help.</p><button type="button" className="button button-primary" onClick={() => setHelpFor("general")}>I need help</button></section>}
    <div className="elder-dose-list">{schedule?.doses.map((dose) => {
      const responded = ["confirmed", "resolved", "cancelled"].includes(dose.state);
      const isDue = dose.uiState === "unconfirmed" || dose.uiState === "snoozed";
      const canReport = new Date(dose.scheduledAt).getTime() <= Date.now() + 60 * 60_000;
      return <article className={`elder-dose ${dose.uiState}`} key={dose.id}>
        <div className="elder-dose-heading"><time dateTime={dose.scheduledAt}>{time(dose.scheduledAt)}</time><span className={`dose-state ${dose.uiState}`}>{dose.uiState === "confirmed" ? "You reported done" : dose.uiState === "snoozed" ? `Reminder moved to ${dose.snoozedUntil ? time(dose.snoozedUntil) : "later"}` : dose.uiState === "unconfirmed" ? "No response yet · ready when you are" : dose.uiState === "needs_help" ? "Your circle has been told" : dose.uiState}</span></div>
        <h3>{dose.snapshot.name}{dose.snapshot.strength ? ` · ${dose.snapshot.strength}` : ""}</h3><p>{dose.snapshot.label}</p>{dose.snapshot.instructionText && <p className="elder-instructions">{dose.snapshot.instructionText}</p>}
        {!responded && <div className="elder-signal-actions">
          <button type="button" className="button button-primary" disabled={Boolean(working) || !canReport} onClick={() => void signal(dose, "ok")}>I’m okay</button>
          <button type="button" className="button button-secondary" disabled={Boolean(working) || !isDue || dose.state === "needs_help" || dose.state === "unconfirmed"} onClick={() => void signal(dose, "not_yet")}>Not yet</button>
          <button type="button" className="button help-button" disabled={Boolean(working)} onClick={() => setHelpFor(helpFor === dose.id ? "" : dose.id)}>I need help</button>
        </div>}
        {helpFor === dose.id && <form className="help-form" onSubmit={(event) => { event.preventDefault(); void askForHelp(dose); }}><label>What would help?<select value={reason[dose.id] ?? "call_me"} onChange={(event) => setReason({ ...reason, [dose.id]: event.target.value })}>{reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{reason[dose.id] === "other" && <label>Optional note<input maxLength={140} value={description} onChange={(event) => setDescription(event.target.value)} /></label>}<div className="circle-actions"><button className="button button-primary" disabled={Boolean(working)}>Send help request</button><button type="button" className="button button-secondary" onClick={() => setHelpFor("")}>Cancel</button></div></form>}
      </article>;
    })}</div>
    {schedule?.doses.length ? <p className="elder-disclaimer">A response is what you tell your circle. It is not proof that medicine was taken. SAATHI is not an emergency-response service; contact local emergency services or a trusted person directly in an emergency.</p> : null}
    {helpFor === "general" && <section className="surface surface-pad help-form"><h3>Ask your care circle for help</h3><form onSubmit={(event) => { event.preventDefault(); void askForHelp(); }}><label>What would help?<select value={reason.general ?? "call_me"} onChange={(event) => setReason({ ...reason, general: event.target.value })}>{reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{reason.general === "other" && <label>Optional note<input maxLength={140} value={description} onChange={(event) => setDescription(event.target.value)} /></label>}<div className="circle-actions"><button className="button button-primary" disabled={Boolean(working)}>Send help request</button><button type="button" className="button button-secondary" onClick={() => setHelpFor("")}>Cancel</button></div></form></section>}
  </section>;
}
