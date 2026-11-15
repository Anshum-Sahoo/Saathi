"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { cookieRequest } from "@/lib/firebase/client-auth";
import { useLanguage } from "@/components/i18n/language-provider";

type Appointment = { id: string; doctorName: string; specialization: string; clinic: string; startsAt: string; timezone: string; purpose: string; notes: string; assignedMemberId: string | null; assignedMemberName: string | null; assignedAcknowledgedAt: string | null; status: string; version: number };
type Member = { id: string; displayName: string; role: string };
type Form = { doctorName: string; specialization: string; clinic: string; date: string; time: string; purpose: string; notes: string; assignedMemberId: string };
const blank: Form = { doctorName: "", specialization: "", clinic: "", date: "", time: "", purpose: "", notes: "", assignedMemberId: "" };

export function AppointmentAgenda() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Appointment[]>([]); const [members, setMembers] = useState<Member[]>([]);
  const [profile, setProfile] = useState<{ member: { id: string; role: string; permissions: Record<string, boolean> }; circle: { timezone: string } } | null>(null);
  const [form, setForm] = useState<Form | null>(null); const [editing, setEditing] = useState<Appointment | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [agenda, me] = await Promise.all([cookieRequest<{ appointments: Appointment[]; timezone: string }>("/api/appointments", "GET"), cookieRequest<typeof profile>("/api/me", "GET")]);
      setItems(agenda.appointments); setProfile(me);
      if (me?.member.permissions.editAppointments) setMembers((await cookieRequest<{ members: Member[] }>("/api/circle/members", "GET")).members.filter((m) => ["family", "caregiver"].includes(m.role)));
    } catch (e) { setError(e instanceof Error ? e.message : "Appointments could not be loaded."); }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(initial); }, [load]);
  const canEdit = profile?.member.permissions.editAppointments === true;
  function edit(item?: Appointment) {
    setEditing(item ?? null);
    setForm(item ? { doctorName: item.doctorName, specialization: item.specialization, clinic: item.clinic, date: item.startsAt.slice(0, 10), time: new Intl.DateTimeFormat("en-GB", { timeZone: item.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(item.startsAt)), purpose: item.purpose, notes: item.notes, assignedMemberId: item.assignedMemberId ?? "" } : { ...blank });
  }
  async function save(e: FormEvent) {
    e.preventDefault(); if (!form) return; setBusy(true); setError("");
    try { await cookieRequest(editing ? `/api/appointments/${encodeURIComponent(editing.id)}` : "/api/appointments", editing ? "PATCH" : "POST", { ...form, assignedMemberId: form.assignedMemberId || null }); setForm(null); setEditing(null); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : t("appointment.invalidFuture")); } finally { setBusy(false); }
  }
  async function update(id: string, status?: string, ack = false) {
    setBusy(true); setError("");
    try { await cookieRequest(ack ? `/api/appointments/${encodeURIComponent(id)}/ack` : `/api/appointments/${encodeURIComponent(id)}`, ack ? "POST" : "PATCH", ack ? {} : { status }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update appointment."); } finally { setBusy(false); }
  }
  return <section id="appointments" className="surface surface-pad appointment-agenda" aria-labelledby="appointment-title">
    <div className="surface-heading"><div><h2 id="appointment-title">{t("appointment.title")}</h2><p>{t("appointment.subtitle", { timezone: profile?.circle.timezone ?? "" })}</p></div>{canEdit && <button className="button button-primary" type="button" onClick={() => edit()}>{t("appointment.add")}</button>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {form && <form className="medicine-form" onSubmit={(e) => void save(e)}><h3>{t(editing ? "appointment.edit" : "appointment.add")}</h3>
      <label>{t("appointment.doctor")}<input required maxLength={100} value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })}/></label>
      <label>{t("appointment.specialty")}<input maxLength={100} value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })}/></label>
      <label>{t("appointment.clinic")}<input required maxLength={140} value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })}/></label>
      <div className="medicine-date-row"><label>{t("appointment.date")}<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/></label><label>{t("appointment.time", { timezone: profile?.circle.timezone ?? "" })}<input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}/></label></div>
      <label>{t("appointment.purpose")}<input required maxLength={180} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}/></label>
      <label>{t("appointment.notes")}<input maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label>
      {canEdit && <label>{t("appointment.responsible")}<select value={form.assignedMemberId} onChange={(e) => setForm({ ...form, assignedMemberId: e.target.value })}><option value="">{t("appointment.unassigned")}</option>{members.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select></label>}
      <div className="circle-actions"><button className="button button-primary" disabled={busy}>{t("appointment.save")}</button><button type="button" className="button button-secondary" onClick={() => { setForm(null); setEditing(null); }}>{t("common.cancel")}</button></div>
    </form>}
    {!items.length && <p className="quiet-placeholder">{t("appointment.noItems")}</p>}
    <div className="appointment-list">{items.map((item) => <article className="appointment-card" key={item.id}><div><time dateTime={item.startsAt}>{new Intl.DateTimeFormat(undefined, { timeZone: item.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(item.startsAt))}</time><h3>{item.doctorName}{item.specialization ? ` · ${item.specialization}` : ""}</h3><p>{item.clinic} · {item.purpose}</p>{item.notes && <p>{item.notes}</p>}<span>{item.assignedMemberName ? `${item.assignedMemberName} · ${item.assignedAcknowledgedAt ? t("appointment.acknowledged") : t("appointment.waitingAck")}` : t("appointment.unassigned")}</span></div><div className="circle-actions">{item.assignedMemberId === profile?.member.id && !item.assignedAcknowledgedAt && <button className="button button-secondary" disabled={busy} onClick={() => void update(item.id, undefined, true)}>{t("appointment.acknowledge")}</button>}{canEdit && <><button className="text-action" disabled={busy} onClick={() => edit(item)}>{t("common.edit")}</button><button className="text-action" disabled={busy} onClick={() => void update(item.id, "completed")}>{t("appointment.complete")}</button><button className="text-action" disabled={busy} onClick={() => void update(item.id, "cancelled")}>{t("appointment.cancel")}</button></>}</div></article>)}</div>
  </section>;
}
