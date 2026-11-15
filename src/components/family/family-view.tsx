"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cookieRequest } from "@/lib/firebase/client-auth";
import { CareOperations } from "@/components/care/care-operations";

type Profile = { member: { displayName: string; role: string; permissions: { viewHistory: boolean } }; circle: { elderName: string; preferredName: string; status: string } };
type Member = { id: string; displayName: string; role: string; tier: string };
type EventItem = { id: string; type: string; at: string; actor?: { displayName?: string } };

export function FamilyView() {
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

  if (!loaded) return <div className="page-wrap"><p role="status">Loading your circle…</p></div>;
  if (!profile) return <div className="page-wrap"><section className="surface surface-pad"><h1>Join your family’s circle</h1><p>{error || "Sign in with the account linked to your invitation."}</p><Link className="button button-primary" href="/login">Sign in</Link><Link className="button button-secondary" href="/register">Create account with invitation</Link></section></div>;
  return <div className="page-wrap">
    <div className="screen-heading"><div><span className="eyebrow">A little closer, wherever you are</span><h1>Care is a shared thing.</h1><p>You are signed in as {profile.member.displayName}. What you can see follows the access the elder approved.</p></div><span className="pill-preview">{profile.circle.status === "active" ? "Care circle active" : "Waiting for consent"}</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dashboard-grid">
      <section className="surface surface-pad"><h2>People in the circle</h2>{members.map((member) => <div className="circle-member" key={member.id}><div><strong>{member.displayName}</strong><span>{member.role.replaceAll("_", " ")}</span></div></div>)}
        <p className="access-note">Family access is limited. You cannot change medicines, appointments, or another member’s permissions.</p>
      </section>
      <section className="surface surface-pad"><h2>Care Memory</h2>{profile.member.permissions.viewHistory ? events.map((item) => <div className="memory-item" key={item.id}><div><strong>{item.type.replaceAll(".", " · ")}</strong><span>{item.actor?.displayName ?? "Circle update"} · {new Date(item.at).toLocaleString()}</span></div></div>) : <p>The elder has not shared Care Memory with this account.</p>}</section>
    </div>
    <CareOperations />
    <button type="button" className="button button-secondary" onClick={() => void cookieRequest("/api/auth/logout", "POST", {}).then(() => window.location.assign("/login"))}>Sign out</button>
  </div>;
}
