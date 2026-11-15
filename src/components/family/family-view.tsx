"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cookieRequest } from "@/lib/firebase/client-auth";
import { CareOperations } from "@/components/care/care-operations";
import { useLanguage } from "@/components/i18n/language-provider";

type Profile = { member: { displayName: string; role: string; permissions: { viewHistory: boolean } }; circle: { elderName: string; preferredName: string; status: string } };
type Member = { id: string; displayName: string; role: string; tier: string };
type EventItem = { id: string; type: string; at: string; actor?: { displayName?: string }; data?: Record<string, unknown> };
const eventKeys: Record<string, string> = { "dose.confirmed": "memory.dose.confirmed", "dose.snoozed": "memory.dose.snoozed", "dose.reminder_due": "memory.dose.due", "dose.snooze_due": "memory.dose.snoozeDue", "help.requested": "memory.help.requested", "alert.claimed": "memory.alert.claimed", "alert.resolved": "memory.alert.resolved", "appointment.created": "memory.appointment.created", "appointment.updated": "memory.appointment.updated", "appointment.assigned": "memory.appointment.assigned", "appointment.acknowledged": "memory.appointment.acknowledged", "appointment.cancelled": "memory.appointment.cancelled", "appointment.completed": "memory.appointment.completed", "appointment.reminder_created": "memory.appointment.reminder", "medication.created": "memory.medication.created", "medication.updated": "memory.medication.updated", "medication.paused": "memory.medication.paused", "medication.discontinued": "memory.medication.discontinued" };

export function FamilyView() {
  const router = useRouter();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const current = await cookieRequest<Profile>("/api/me", "GET");
        setProfile(current);
        const circleMembers = await cookieRequest<{ members: Member[] }>("/api/circle/members", "GET");
        setMembers(circleMembers.members);
        if (current.member.permissions.viewHistory) {
          const history = await cookieRequest<{ items: EventItem[] }>("/api/memory?limit=20", "GET");
          setEvents(history.items);
        }
      } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Sign in to see your circle."); }
      finally { setLoaded(true); }
    })();
  }, []);

  if (!loaded) return <div className="page-wrap"><p role="status">{t("common.loading")}</p></div>;
  if (!profile) return <div className="page-wrap"><section className="surface family-empty-state"><h1>{t("family.join")}</h1><p>{error || t("family.signInHint")}</p><Link className="button button-primary" href="/login">{t("nav.signIn")}</Link><Link className="button button-secondary" href="/register">{t("family.createAccount")}</Link></section></div>;
  return <div className="page-wrap">
    <div className="screen-heading"><div><span className="eyebrow">{t("family.eyebrow")}</span><h1>{t("family.title")}</h1><p>{t("family.signedIn", { name: profile.member.displayName })}</p></div><span className="pill-preview">{profile.circle.status === "active" ? t("family.active") : t("care.waitingTitle")}</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dashboard-grid">
      <section className="surface surface-pad"><h2>{t("family.people")}</h2>{members.map((member) => <div className="circle-member" key={member.id}><div><strong>{member.displayName}</strong><span>{member.role.replaceAll("_", " ")}</span></div></div>)}
        <p className="access-note">{t("family.accessNote")}</p>
      </section>
      <section className="surface surface-pad"><h2>{t("memory.title")}</h2>{profile.member.permissions.viewHistory ? events.map((item) => { const name = item.actor?.displayName ?? t("memory.circle"); const outcome = String(item.data?.outcome ?? "other"); return <div className="memory-item" key={item.id}><div><strong>{t(eventKeys[item.type] ?? "memory.circle", { name, actor: name, label: String(item.data?.label ?? t("care.today")), outcome: t(`memory.outcome.${outcome}`) })}</strong><span>{name} · {new Date(item.at).toLocaleString()}</span></div></div>; }) : <p>{t("family.noMemory")}</p>}</section>
    </div>
    <CareOperations />
    <button type="button" className="button button-secondary" onClick={() => void cookieRequest("/api/auth/logout", "POST", {}).then(() => router.push("/login"))}>{t("family.signOut")}</button>
  </div>;
}
