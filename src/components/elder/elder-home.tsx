"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cookieRequest } from "@/lib/firebase/client-auth";
import { MedicationRoutine } from "./medication-routine";
import { useLanguage } from "@/components/i18n/language-provider";

type Current = { member: { role: string; displayName: string }; circle: { preferredName: string; elderName: string; status: string } };

export function ElderHome() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState<Current | null>(null);
  const [largeText, setLargeText] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void cookieRequest<Current>("/api/me", "GET").then((data) => { setCurrent(data); setConnected(true); }).catch(() => setConnected(false)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-wrap"><p role="status">{t("common.loading")}</p></div>;

  if (current?.member.role === "elder") return <div className={`page-wrap elder-home ${largeText ? "large-text" : ""}`}>
    <section className="elder-welcome"><div><span className="eyebrow">{t("elder.greeting", { name: current.circle.preferredName })}</span><h1>{t("elder.today.title")}</h1><p>{t("elder.refreshHint")}</p></div><div className="elder-tools"><button type="button" className="tool-button" aria-pressed={largeText} onClick={() => setLargeText(!largeText)}>{t("elder.textSize")}: {t(largeText ? "elder.textSize.extraLarge" : "elder.textSize.normal")}</button><span className="pill-preview">{current.circle.status === "active" ? t("elder.connected") : t("elder.waitingConsent")}</span></div></section>
    {current.circle.status === "active" ? <MedicationRoutine /> : <section className="surface surface-pad elder-summary"><h2>{t("elder.routinePending")}</h2><p>{t("care.waitingConsent")}</p></section>}
    <section className="surface surface-pad elder-summary"><h2>{t("family.people")}</h2><p>{t("elder.circlePin")}</p><Link className="button button-secondary" href="/care-circle">{t("nav.circle")}</Link></section>
    <p className="elder-disclaimer">{t("footer.safety")}</p>
  </div>;

  return <div className="page-wrap elder-home">
    <section className="elder-welcome"><div><span className="eyebrow">A calmer place for daily care</span><h1>Elder Mode</h1><p>{connected ? "This account is not paired as an elder device." : "Pair this phone or tablet once. After setup, Elder Mode opens without a daily sign-in."}</p></div></section>
    <section className="surface surface-pad elder-summary"><h2>Connect a device</h2><p>Use the one-time code shared by your caregiver. You choose a PIN and decide whether to accept care sharing.</p><Link className="button button-primary" href="/pair-device">Pair this device</Link></section>
    <p className="elder-disclaimer">SAATHI sends reminders and messages. It does not give medical advice and is not an emergency service.</p>
  </div>;
}
