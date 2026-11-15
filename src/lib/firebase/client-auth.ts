"use client";

type FirebaseAuthResponse = { idToken: string };

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function authenticate(method: "accounts:signUp" | "accounts:signInWithPassword", email: string, password: string): Promise<string> {
  if (!apiKey) throw new Error("Firebase sign-in is not configured yet. Add the public Firebase web API key.");
  let response: Response;
  try {
    response = await fetch(`https://identitytoolkit.googleapis.com/v1/${method}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  } catch {
    throw new Error("Could not reach Firebase Authentication. Check your connection and try again.");
  }
  const data = await response.json() as FirebaseAuthResponse | { error?: { message?: string } };
  if (!response.ok || !("idToken" in data)) {
    const code = "error" in data ? data.error?.message : undefined;
    if (code === "EMAIL_EXISTS") throw new Error("An account already uses this email. Sign in instead.");
    if (code === "INVALID_LOGIN_CREDENTIALS" || code === "EMAIL_NOT_FOUND" || code === "INVALID_PASSWORD") throw new Error("The email or password did not match.");
    if (code === "WEAK_PASSWORD") throw new Error("Choose a password with at least 8 characters.");
    throw new Error("Firebase Authentication could not complete this request.");
  }
  return data.idToken;
}

export function createEmailPasswordAccount(email: string, password: string) {
  return authenticate("accounts:signUp", email, password);
}

export function signInEmailPassword(email: string, password: string) {
  return authenticate("accounts:signInWithPassword", email, password);
}

export async function saathiRequest<T>(path: string, idToken: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${idToken}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const payload = await response.json() as T | { error?: { message?: string } };
  if (!response.ok) throw new Error("error" in payload ? payload.error?.message ?? "That request could not be completed." : "That request could not be completed.");
  return payload as T;
}

export async function publicRequest<T>(path: string, body: unknown, idToken?: string): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify(body), cache: "no-store",
  });
  const payload = await response.json() as T | { error?: { message?: string } };
  if (!response.ok) throw new Error("error" in payload ? payload.error?.message ?? "That request could not be completed." : "That request could not be completed.");
  return payload as T;
}

export async function cookieRequest<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const payload = await response.json() as T | { error?: { message?: string } };
  if (!response.ok) throw new Error("error" in payload ? payload.error?.message ?? "That request could not be completed." : "That request could not be completed.");
  return payload as T;
}
