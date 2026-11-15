"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { cookieRequest, publicRequest } from "@/lib/firebase/client-auth";

export function PairDeviceForm() {
  const router = useRouter();
  const [paired, setPaired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    try {
      const result = await publicRequest<{ needsConsent: boolean }>("/api/auth/pair", { code });
      if (!result.needsConsent) router.replace("/elder"); else setPaired(true);
    } catch (pairError) { setError(pairError instanceof Error ? pairError.message : "That code could not be used."); }
    finally { setBusy(false); }
  }

  async function acceptConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const pin = String(data.get("pin") ?? "");
    const confirmPin = String(data.get("confirmPin") ?? "");
    try {
      await cookieRequest("/api/circle/consent", "POST", { pin, confirmPin, accepted: true });
      router.replace("/elder");
    } catch (consentError) { setError(consentError instanceof Error ? consentError.message : "We could not save your choice."); }
    finally { setBusy(false); }
  }

  return <div className="page-wrap auth-wrap elder-pair-wrap">
    <section className="auth-panel elder-pair-panel" aria-labelledby="pair-title">
      <span className="eyebrow">Your device, your choice</span>
      {!paired ? <>
        <h1 id="pair-title">Connect this device</h1>
        <p className="auth-intro">Ask someone in your care circle for a one-time code. It expires after 10 minutes.</p>
        <form className="saathi-form" onSubmit={pair}>
          <label>Pairing code<input name="code" autoComplete="one-time-code" autoCapitalize="characters" required minLength={10} maxLength={20} /></label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? "Connecting…" : "Connect device"}</button>
        </form>
      </> : <>
        <h1 id="pair-title">Choose your PIN and sharing</h1>
        <p className="auth-intro">Your PIN protects important changes. Your care circle will see the elder profile and the updates you choose to share. You can change access later.</p>
        <form className="saathi-form" onSubmit={acceptConsent}>
          <label>Choose a 4 to 6 digit PIN<input name="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} required /></label>
          <label>Enter the PIN again<input name="confirmPin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} required /></label>
          <label className="consent-check"><input type="checkbox" name="consent" required /><span>I agree to share care information with the members of this circle. I can change who sees what later.</span></label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Agree and open Elder Mode"}</button>
        </form>
      </>}
      <p className="auth-switch"><Link href="/">Back to SAATHI</Link></p>
    </section>
  </div>;
}
