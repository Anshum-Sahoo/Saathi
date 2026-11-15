"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cookieRequest } from "@/lib/firebase/client-auth";

type Member = { id: string; displayName: string; role: string; tier: string; permissions?: Record<string, boolean> };
type Circle = { id: string; elderName: string; preferredName: string; status: string; timezone: string };
type Device = { id: string; deviceLabel: string; createdAt: string; lastSeenAt: string };
type Memory = { id: string; type: string; at: string; actor?: { displayName?: string }; data?: Record<string, unknown> };
type Me = { member: Member; circle: Circle };

const permissionNames: Record<string, string> = {
  viewSchedule: "See the care schedule", viewHistory: "See Care Memory", editMedications: "Edit medicines",
  editAppointments: "Edit appointments", viewPrivateAppointments: "See private appointments",
  receiveAlerts: "Receive care alerts", manageCircle: "Invite and remove members",
};

export function CareCirclePanel({ setup = false }: { setup?: boolean }) {
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [memory, setMemory] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [inviteRole, setInviteRole] = useState("family");
  const [pin, setPin] = useState("");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const current = await cookieRequest<Me>("/api/me", "GET");
      setMe(current);
      const list = await cookieRequest<{ members: Member[] }>("/api/circle/members", "GET");
      setMembers(list.members);
      if (current.member.role === "caregiver" && current.member.permissions?.manageCircle) {
        const response = await cookieRequest<{ devices: Device[] }>("/api/circle/devices", "GET");
        setDevices(response.devices);
      }
      if (current.member.role === "elder" || current.member.permissions?.viewHistory) {
        const log = await cookieRequest<{ items: Memory[] }>("/api/memory?limit=12", "GET");
        setMemory(log.items);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Sign in to see your care circle.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function perform(action: () => Promise<unknown>) {
    setWorking(true);
    setError("");
    try { await action(); await load(); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "That action could not be completed."); }
    finally { setWorking(false); }
  }

  async function createInvite() {
    const result = await cookieRequest<{ invite: { code: string } }>("/api/circle/invites", "POST", { role: inviteRole });
    setInviteCode(result.invite.code);
  }

  async function createPairingCode() {
    const result = await cookieRequest<{ code: string }>("/api/circle/pairing-codes", "POST", {});
    setPairingCode(result.code);
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.displayName} from this care circle?`)) return;
    await perform(() => cookieRequest(`/api/circle/members/${encodeURIComponent(member.id)}`, "DELETE"));
  }

  async function savePermissions() {
    if (!editingMember) return;
    await perform(async () => {
      if (pin) {
        await cookieRequest("/api/auth/step-up", "POST", { pin });
        setPin("");
      }
      await cookieRequest(`/api/circle/members/${encodeURIComponent(editingMember.id)}`, "PATCH", { permissions });
      setEditingMember(null);
    });
  }

  async function revokeDevice(device: Device) {
    if (!window.confirm("Remove this paired device? It will need a new pairing code.")) return;
    await perform(() => cookieRequest(`/api/circle/devices/${encodeURIComponent(device.id)}`, "DELETE"));
  }

  async function signOut() {
    setWorking(true);
    try { await cookieRequest("/api/auth/logout", "POST", {}); window.location.assign("/login"); }
    catch (signOutError) { setError(signOutError instanceof Error ? signOutError.message : "Sign out could not be completed."); setWorking(false); }
  }

  if (loading) return <div className="page-wrap"><p role="status">Loading your care circle…</p></div>;
  if (!me) return <div className="page-wrap"><section className="surface surface-pad"><h1>Sign in to continue</h1><p>{error}</p><Link className="button button-primary" href="/login">Go to sign in</Link></section></div>;
  const canManage = me.member.role === "caregiver" && Boolean(me.member.permissions?.manageCircle);
  const canElderManage = me.member.role === "elder";

  return (
    <div className="page-wrap">
      <div className="screen-heading">
        <div><span className="eyebrow">Care, shared with care</span><h1>{setup ? "Your circle is ready to begin." : "Your care circle"}</h1><p>{me.circle.preferredName} is at the centre. Members and devices are shown according to their access.</p></div>
        <span className="pill-preview">{me.circle.status === "active" ? "Sharing is active" : "Waiting for elder consent"}</span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {me.circle.status !== "active" && <section className="surface surface-pad circle-notice"><h2>Next: pair the elder’s device</h2><p>Generate a one-time code and share it with {me.circle.preferredName}. They will set a PIN and choose whether to accept care sharing.</p></section>}

      <div className="dashboard-grid circle-grid">
        <div className="stack">
          <section className="surface surface-pad" aria-labelledby="members-title">
            <div className="surface-heading"><div><h2 id="members-title">People in this circle</h2><p>Access is checked again on every request.</p></div></div>
            {members.map((member) => <article className="circle-member" key={member.id}>
              <div><strong>{member.displayName}</strong><span>{member.role.replaceAll("_", " ")} · {member.tier}</span></div>
              <div className="circle-actions">
                {canElderManage && member.role !== "elder" && <button type="button" className="button button-secondary" onClick={() => { setEditingMember(member); setPermissions(member.permissions ?? {}); }}>Change access</button>}
                {member.role !== "elder" && (canElderManage || canManage) && <button type="button" className="text-action" disabled={working} onClick={() => void removeMember(member)}>Remove</button>}
              </div>
            </article>)}
            {!members.length && <p>No members are connected yet.</p>}
          </section>

          {editingMember && <section className="surface surface-pad" aria-labelledby="permissions-title">
            <h2 id="permissions-title">What {editingMember.displayName} can see</h2>
            <p>Enter your PIN to approve this change. SAATHI will record it in Care Memory.</p>
            <div className="permission-list">{Object.entries(permissionNames).map(([key, label]) => <label className="permission-row" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(permissions[key])} onChange={(event) => setPermissions((value) => ({ ...value, [key]: event.target.checked }))} /></label>)}</div>
            <label className="pin-inline">Elder PIN<input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} /></label>
            <div className="circle-actions"><button type="button" className="button button-primary" disabled={working || pin.length < 4} onClick={() => void savePermissions()}>Save access</button><button type="button" className="button button-secondary" onClick={() => { setEditingMember(null); setPin(""); }}>Cancel</button></div>
          </section>}

          {canManage && <section className="surface surface-pad" aria-labelledby="invite-title">
            <h2 id="invite-title">Invite someone to the circle</h2>
            <p>Share a one-time invitation code. Family members create their own Firebase account to join.</p>
            <div className="invite-row"><label>Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="family">Family member</option><option value="emergency_contact">Emergency contact</option></select></label><button className="button button-primary" type="button" disabled={working} onClick={() => void perform(createInvite)}>Create invitation</button></div>
            {inviteCode && <div className="code-reveal"><span>Share once · expires in 24 hours</span><strong>{inviteCode}</strong><button className="text-action" type="button" onClick={() => void navigator.clipboard?.writeText(inviteCode)}>Copy code</button></div>}
          </section>}

          {(canManage || canElderManage) && <section className="surface surface-pad" aria-labelledby="pairing-title">
            <h2 id="pairing-title">Elder device</h2><p>Pair a phone or tablet so Elder Mode opens without a daily sign-in.</p>
            <button className="button button-primary" type="button" disabled={working} onClick={() => void perform(createPairingCode)}>Generate pairing code</button>
            {pairingCode && <div className="code-reveal"><span>One use · expires in 10 minutes</span><strong>{pairingCode}</strong><button className="text-action" type="button" onClick={() => void navigator.clipboard?.writeText(pairingCode)}>Copy code</button></div>}
            <h3 className="subsection-title">Paired devices</h3>
            {devices.map((device) => <div className="circle-member" key={device.id}><div><strong>{device.deviceLabel}</strong><span>Last active {new Date(device.lastSeenAt).toLocaleString()}</span></div><button type="button" className="text-action" disabled={working} onClick={() => void revokeDevice(device)}>Revoke</button></div>)}
            {!devices.length && canManage && <p>No elder devices are paired yet.</p>}
          </section>}
        </div>

        <aside className="stack">
          <section className="surface surface-pad" aria-labelledby="profile-title"><h2 id="profile-title">Elder profile</h2><p><strong>{me.circle.elderName}</strong><br />Preferred name: {me.circle.preferredName}<br />Time zone: {me.circle.timezone}</p></section>
          {memory.length > 0 && <section className="surface surface-pad" aria-labelledby="memory-title"><h2 id="memory-title">Care Memory</h2><div className="memory-list">{memory.map((item) => <div className="memory-item" key={item.id}><div><strong>{item.type.replaceAll(".", " · ")}</strong><span>{item.actor?.displayName ?? "Circle update"} · {new Date(item.at).toLocaleString()}</span></div></div>)}</div></section>}
          <button type="button" className="button button-secondary" disabled={working} onClick={() => void signOut()}>Sign out</button>
        </aside>
      </div>
    </div>
  );
}
