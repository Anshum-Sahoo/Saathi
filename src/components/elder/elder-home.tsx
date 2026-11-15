"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cookieRequest } from "@/lib/firebase/client-auth";

type Current = { member: { role: string; displayName: string }; circle: { preferredName: string; elderName: string; status: string } };

export function ElderHome() {
  const [current, setCurrent] = useState<Current | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void cookieRequest<Current>("/api/me", "GET").then((data) => { setCurrent(data); setConnected(true); }).catch(() => setConnected(false)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-wrap"><p role="status">Opening Elder Mode…</p></div>;

  if (current?.member.role === "elder") return <div className="page-wrap elder-home">
    <section className="elder-welcome"><div><span className="eyebrow">Your care, your way</span><h1>Namaste, {current.circle.preferredName}</h1><p>This device is paired. You can open Elder Mode here whenever you need it.</p></div><span className="pill-preview">{current.circle.status === "active" ? "Your circle is connected" : "Your circle is waiting for consent"}</span></section>
    <section className="surface surface-pad elder-summary"><h2>Your circle</h2><p>{current.circle.elderName} is connected with {current.circle.preferredName}’s care circle. Your PIN is only needed when you change important sharing settings.</p><Link className="button button-secondary" href="/care-circle">Review my care circle</Link></section>
    <p className="elder-disclaimer">SAATHI helps your circle stay in touch. It does not give medical advice and is not an emergency service.</p>
  </div>;

  return <div className="page-wrap elder-home">
    <section className="elder-welcome"><div><span className="eyebrow">A calmer place for daily care</span><h1>Elder Mode</h1><p>{connected ? "This account is not paired as an elder device." : "Pair this phone or tablet once. After setup, Elder Mode opens without a daily sign-in."}</p></div></section>
    <section className="surface surface-pad elder-summary"><h2>Connect a device</h2><p>Use the one-time code shared by your caregiver. You choose a PIN and decide whether to accept care sharing.</p><Link className="button button-primary" href="/pair-device">Pair this device</Link></section>
    <p className="elder-disclaimer">SAATHI sends reminders and messages. It does not give medical advice and is not an emergency service.</p>
  </div>;
}
