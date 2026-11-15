"use client";

import { useState } from "react";
import { cookieRequest } from "@/lib/firebase/client-auth";
import { useLanguage } from "@/components/i18n/language-provider";

export function ReminderCheck() {
  const { t } = useLanguage(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function check() {
    setBusy(true); setError(""); setMessage("");
    try { const result = await cookieRequest<{ doses: number; snoozes: number; appointments: number }>("/api/reminders/process", "POST", {}); setMessage(t("reminder.result", result)); }
    catch (e) { setError(e instanceof Error ? e.message : "Reminder check failed."); } finally { setBusy(false); }
  }
  return <section className="surface surface-pad reminder-check"><h2>{t("reminder.title")}</h2><button className="button button-secondary" type="button" disabled={busy} onClick={() => void check()}>{t(busy ? "reminder.checking" : "reminder.checkNow")}</button>{message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}</section>;
}
