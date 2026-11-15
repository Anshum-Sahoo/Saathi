"use client";

import { useSyncExternalStore, useState, type FormEvent } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import {
  acknowledgeDemoAppointment, advanceDemo, claimDemoAlert, createDemoAppointment,
  demoSeed, requestDemoHelp, resolveDemoAlert, saveDemoMedication,
  recordDemoDose, updateDemoAppointment, type DemoState,
} from "@/lib/demo/model";

const storageKey = "saathi-fictional-demo-v2";
const demoListeners = new Set<() => void>();
function subscribeDemo(listener: () => void) { demoListeners.add(listener); window.addEventListener("storage", listener); return () => { demoListeners.delete(listener); window.removeEventListener("storage", listener); }; }
function getSavedDemo() { try { const saved = window.localStorage.getItem(storageKey) ?? ""; if (saved) JSON.parse(saved); return saved; } catch { return ""; } }
function saveDemo(state: DemoState) { try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* demo remains available for this tab */ } demoListeners.forEach((listener) => listener()); }
type Role = "caregiver" | "elder" | "family";
const eventKeys: Record<string, string> = {
  "medication.created": "memory.medication.created", "medication.updated": "memory.medication.updated",
  "dose.confirmed": "memory.dose.confirmed", "dose.snoozed": "memory.dose.snoozed",
  "help.requested": "memory.help.requested", "alert.claimed": "memory.alert.claimed", "alert.resolved": "memory.alert.resolved",
  "appointment.created": "memory.appointment.created", "appointment.updated": "memory.appointment.updated",
  "appointment.assigned": "memory.appointment.assigned", "appointment.acknowledged": "memory.appointment.acknowledged",
  "appointment.cancelled": "memory.appointment.cancelled", "appointment.completed": "memory.appointment.completed",
};

export default function DemoPage() {
  const { language, setLanguage, t } = useLanguage();
  const savedState = useSyncExternalStore(subscribeDemo, getSavedDemo, () => "");
  const state = savedState ? JSON.parse(savedState) as DemoState : demoSeed();
  const [role, setRole] = useState<Role>("caregiver");
  const [medicine, setMedicine] = useState({ id: "", name: "", strength: "", note: "" });
  const [doctor, setDoctor] = useState("");
  const [assignee, setAssignee] = useState("Maya (family)");
  const [editingAppointment, setEditingAppointment] = useState("");

  const update = (fn: (current: DemoState) => DemoState) => saveDemo(fn(state));

  function saveMedicine(event: FormEvent) {
    event.preventDefault();
    if (!medicine.name.trim()) return;
    update((current) => saveDemoMedication(current, { ...medicine, name: medicine.name.trim() }));
    setMedicine({ id: "", name: "", strength: "", note: "" });
  }

  function saveAppointment(event: FormEvent) {
    event.preventDefault();
    if (!doctor.trim()) return;
    update((current) => editingAppointment
      ? updateDemoAppointment(current, editingAppointment, { doctor: doctor.trim(), assigned: assignee, at: current.now + 30 * 60 * 60_000, status: "scheduled" })
      : createDemoAppointment(current, { doctor: doctor.trim(), assigned: assignee, at: current.now + 30 * 60 * 60_000 }));
    setDoctor(""); setEditingAppointment("");
  }

  function editAppointment(id: string, name: string, assigned: string) {
    setEditingAppointment(id); setDoctor(name); setAssignee(assigned);
  }

  return <main className="page-wrap demo-page">
    <div className="demo-banner" role="note"><strong>{t("demo.banner")}</strong><span>{t("demo.disclaimer")}</span></div>
    <div className="screen-heading">
      <div><span className="eyebrow">SAATHI · {t("nav.demo")}</span><h1>{t("care.shared")}</h1><p>{t("demo.time", { time: new Date(state.now).toLocaleString(language === "hi" ? "hi-IN" : "en-IN") })}</p></div>
      <label>{t("demo.role")}<select value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="caregiver">{t("demo.caregiver")}</option><option value="elder">{t("demo.elder")}</option><option value="family">{t("demo.family")}</option></select></label>
    </div>
    <div className="demo-controls">
      <button className="button button-secondary" onClick={() => update((current) => advanceDemo(current, 15 * 60_000))}>{t("demo.advance15")}</button>
      <button className="button button-secondary" onClick={() => update((current) => advanceDemo(current, 60 * 60_000))}>{t("demo.advanceHour")}</button>
      <button className="button button-secondary" onClick={() => update((current) => advanceDemo(current, 24 * 60 * 60_000))}>{t("demo.advanceDay")}</button>
      <button className="button button-secondary" onClick={() => { if (window.confirm(t("demo.resetConfirm"))) { saveDemo(demoSeed()); setRole("caregiver"); } }}>{t("demo.reset")}</button>
      <button className="button button-secondary" onClick={() => setLanguage(language === "en" ? "hi" : "en")}>{language === "en" ? "हिन्दी" : "English"}</button>
    </div>

    <div className="dashboard-grid">
      <section className="surface surface-pad">
        <h2>{role === "elder" ? t("elder.today.title") : t("care.today")}</h2>
        {!state.medications.length && <p className="quiet-placeholder">{t("care.noMedicines")}</p>}
        {state.medications.map((item, index) => <article className={`elder-dose ${state.doseState}`} key={item.id}>
          <time>{new Date(state.now).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-IN", { hour: "numeric", minute: "2-digit" })}</time>
          <h3>{item.name}{item.strength ? ` · ${item.strength}` : ""}</h3><p>{item.note || t("demo.afterBreakfast")}</p>
          <p>{t(`common.status.${state.doseState === "unconfirmed" ? "unconfirmed" : state.doseState}`)}</p>
          {role === "elder" && index === 0 && state.doseState !== "confirmed" && <div className="circle-actions">
            <button className="button button-primary" onClick={() => update((current) => recordDemoDose(current, "confirmed"))}>{t("elder.signal.ok")}</button>
            <button className="button button-secondary" onClick={() => update((current) => recordDemoDose(current, "snoozed"))}>{t("elder.signal.notYet")}</button>
            <button className="button help-button" onClick={() => update(requestDemoHelp)}>{t("elder.signal.help")}</button>
          </div>}
          {role === "caregiver" && <div className="circle-actions"><button className="text-action" onClick={() => setMedicine(item)}>{t("common.edit")}</button></div>}
        </article>)}
        {role === "caregiver" && <form className="medicine-form" onSubmit={saveMedicine}>
          <h3>{medicine.id ? t("care.editMedicine") : t("care.addMedicine")}</h3>
          <label>{t("care.medicineName")}<input required maxLength={100} value={medicine.name} onChange={(event) => setMedicine({ ...medicine, name: event.target.value })}/></label>
          <label>{t("care.strength")}<input maxLength={60} value={medicine.strength} onChange={(event) => setMedicine({ ...medicine, strength: event.target.value })}/></label>
          <label>{t("care.elderNote")}<input maxLength={160} value={medicine.note} onChange={(event) => setMedicine({ ...medicine, note: event.target.value })}/></label>
          <div className="circle-actions"><button className="button button-primary">{t("common.save")}</button>{medicine.id && <button type="button" className="button button-secondary" onClick={() => setMedicine({ id: "", name: "", strength: "", note: "" })}>{t("common.cancel")}</button>}</div>
        </form>}

        <h2>{t("appointment.title")}</h2>
        {state.appointments.map((item) => <article className="appointment-card" key={item.id}>
          <div><time>{new Date(item.at).toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</time><h3>{item.doctor}</h3><p>{t("demo.fictionalClinic")}</p><span>{item.assigned} · {item.acknowledged ? t("appointment.acknowledged") : t("appointment.waitingAck")}</span><p>{t(item.status === "scheduled" ? "common.status.scheduled" : `appointment.status.${item.status}`)}</p></div>
          {role === "family" && item.assigned.startsWith("Maya") && !item.acknowledged && item.status === "scheduled" && <button className="button button-secondary" onClick={() => update((current) => acknowledgeDemoAppointment(current, item.id))}>{t("appointment.acknowledge")}</button>}
          {role === "caregiver" && <div className="circle-actions"><button className="text-action" onClick={() => editAppointment(item.id, item.doctor, item.assigned)}>{t("common.edit")}</button><button className="text-action" onClick={() => update((current) => updateDemoAppointment(current, item.id, { status: "cancelled" }))}>{t("appointment.cancel")}</button><button className="text-action" onClick={() => update((current) => updateDemoAppointment(current, item.id, { status: "completed" }))}>{t("appointment.complete")}</button></div>}
        </article>)}
        {role === "caregiver" && <form className="medicine-form" onSubmit={saveAppointment}>
          <h3>{t(editingAppointment ? "appointment.edit" : "appointment.add")}</h3>
          <label>{t("appointment.doctor")}<input required maxLength={100} value={doctor} onChange={(event) => setDoctor(event.target.value)}/></label>
          <label>{t("appointment.responsible")}<select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="Maya (family)">{t("demo.family")}</option><option value="Ravi (caregiver)">{t("demo.caregiver")}</option></select></label>
          <div className="circle-actions"><button className="button button-primary">{t("appointment.save")}</button>{editingAppointment && <button type="button" className="button button-secondary" onClick={() => { setDoctor(""); setEditingAppointment(""); }}>{t("common.cancel")}</button>}</div>
        </form>}
      </section>

      <section className="surface surface-pad">
        <h2>{t("care.alerts")}</h2><article className="request-card">
          <h3>{t("notification.help.title", { elder: "Anita" })}</h3><p>{t("notification.help.body")}</p>
          <p>{state.alert.status === "open" ? t("care.noResponse") : state.alert.status === "claimed" ? t("care.owner", { name: state.alert.owner ?? "Maya" }) : t("care.resolvedNotice")}</p>
          {role === "elder" && <button className="button help-button" onClick={() => update(requestDemoHelp)}>{t("elder.signal.help")}</button>}
          {role !== "elder" && state.alert.status === "open" && <button className="button button-primary" onClick={() => update((current) => claimDemoAlert(current, role === "family" ? "Maya (family)" : "Ravi (caregiver)"))}>{t("care.claim")}</button>}
          {role !== "elder" && state.alert.status === "claimed" && state.alert.owner === (role === "family" ? "Maya (family)" : "Ravi (caregiver)") && <button className="button button-secondary" onClick={() => update(resolveDemoAlert)}>{t("care.resolvePrompt")}</button>}
        </article>
        <h2>{t("notification.title")}</h2>
        {state.notifications.length ? state.notifications.slice().reverse().map((item) => {
          const appointment = item.id.startsWith("appointment-");
          const snooze = item.id.startsWith("dose-snooze-");
          const help = item.id.startsWith("help-request-");
          const titleKey = help ? "notification.help.title" : appointment ? "notification.appointment.title" : snooze ? "notification.snooze.title" : "notification.dose.title";
          const bodyKey = help ? "notification.help.body" : appointment ? "notification.appointment.body" : snooze ? "notification.snooze.body" : "notification.dose.body";
          const appointmentRecord = state.appointments.find((candidate) => item.id.includes(`${candidate.id}-v`));
          return <article key={item.id} className="notification-card"><strong>{t(titleKey, { elder: "Anita" })}</strong><p>{t(bodyKey, { elder: "Anita", doctor: appointmentRecord?.doctor ?? "Dr. Meera Rao", phase: item.id.endsWith("1h") ? "1 hour" : "24 hours", time: "09:00" })}</p><span>{new Date(item.at).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-IN")}</span></article>;
        }) : <p>{t("notification.empty")}</p>}
      </section>
    </div>
    <section className="surface surface-pad"><h2>{t("memory.title")}</h2>{state.events.length ? state.events.slice(-12).reverse().map((event) => { const actor = event.actor; return <div className="memory-item" key={event.id}><div><strong>{t(eventKeys[event.type] ?? "memory.circle", { name: actor, actor, label: t("care.today"), outcome: t("memory.outcome.other") })}</strong><span>{actor} · {new Date(event.at).toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</span></div></div>; }) : <p>{t("demo.sharedBrowser")}</p>}</section>
  </main>;
}
