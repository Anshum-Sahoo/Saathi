"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createEmailPasswordAccount, publicRequest, signInEmailPassword, saathiRequest } from "@/lib/firebase/client-auth";

type Props = { mode: "register" | "login" | "setup" };

export function CredentialForm({ mode }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joiningWithInvite, setJoiningWithInvite] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();
    try {
      if (mode === "login") {
        const token = await signInEmailPassword(email, password);
        const result = await saathiRequest<{ member: { role: string } }>("/api/auth/session", token, {});
        router.replace(result.member.role === "caregiver" ? "/care-circle" : "/family");
        return;
      }

      const inviteCode = String(data.get("inviteCode") ?? "").trim();
      let token: string;
      if (mode === "register") {
        try { token = await createEmailPasswordAccount(email, password); }
        catch (accountError) {
          if (!inviteCode || !(accountError instanceof Error) || !accountError.message.includes("already uses this email")) throw accountError;
          token = await signInEmailPassword(email, password);
        }
      } else {
        token = await signInEmailPassword(email, password);
      }
      if (inviteCode) {
        await saathiRequest("/api/invites/accept", token, { code: inviteCode, displayName: name });
        router.replace("/family");
        return;
      }
      if (!String(data.get("elderName") ?? "").trim() || !String(data.get("preferredName") ?? "").trim()) {
        throw new Error("Add the elder’s name and preferred name to create a new circle.");
      }
      await publicRequest("/api/circles", {
        caregiverName: name,
        elderName: String(data.get("elderName") ?? "").trim(),
        preferredName: String(data.get("preferredName") ?? "").trim(),
        timezone: String(data.get("timezone") ?? "Asia/Kolkata"),
      }, token);
      router.replace("/setup");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not finish that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";
  const isSetup = mode === "setup";
  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <span className="eyebrow">{isLogin ? "Welcome back" : isSetup ? "Your care circle" : "Start with your circle"}</span>
      <h1 id="auth-title">{isLogin ? "Sign in to SAATHI" : isSetup ? "Finish circle setup" : "Create your caregiver account"}</h1>
      <p className="auth-intro">{isLogin ? "Sign in with the email and password for your care circle." : "Your account is secured by Firebase Authentication. SAATHI never stores your password."}</p>
      <form className="saathi-form" onSubmit={submit}>
        {!isLogin && <label>Your name<input name="name" autoComplete="name" required maxLength={80} /></label>}
        <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254} /></label>
        <label>Password<input type="password" name="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={8} maxLength={128} /></label>
        {!isLogin && <>
          {mode === "register" && <label>Invitation code <span className="field-note">Enter one to join a family circle</span><input name="inviteCode" autoCapitalize="characters" autoComplete="off" maxLength={20} onChange={(event) => setJoiningWithInvite(Boolean(event.target.value.trim()))} /></label>}
          {!joiningWithInvite && <>
            {mode === "register" && <div className="form-divider"><span>Set up a new caregiver circle</span></div>}
            <label>Elder’s full name<input name="elderName" maxLength={80} /></label>
            <label>What should we call them?<input name="preferredName" maxLength={60} /></label>
            <label>Circle time zone<select name="timezone" defaultValue="Asia/Kolkata"><option value="Asia/Kolkata">India · Asia/Kolkata</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option></select></label>
          </>}
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Sign in" : isSetup ? "Create care circle" : "Create account and continue"}</button>
      </form>
      <p className="auth-switch">{isLogin ? <>New to SAATHI? <Link href="/register">Create an account</Link></> : <>Already registered? <Link href="/login">Sign in</Link></>}</p>
      {isLogin && <p className="auth-switch"><Link href="/setup">I created an account but still need to set up my circle</Link></p>}
    </section>
  );
}
