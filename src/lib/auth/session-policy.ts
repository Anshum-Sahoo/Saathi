import { randomToken, tokenHash } from "./crypto.ts";
import type { SessionRecord } from "./types";

export function isSessionActive(expiresAt: number, absoluteExpiresAt: number | undefined, now: number): boolean {
  return expiresAt > now && (absoluteExpiresAt === undefined || absoluteExpiresAt > now);
}

export function sessionLifetimes(kind: SessionRecord["kind"], now: number) {
  const idleMs = kind === "elder_device" ? 30 * 24 * 60 * 60_000 : 12 * 60 * 60_000;
  const absoluteExpiresAt = kind === "member" ? now + 7 * 24 * 60 * 60_000 : undefined;
  return { idleExpiresAt: now + idleMs, cookieExpiresAt: absoluteExpiresAt ?? now + idleMs, absoluteExpiresAt };
}

export function createSessionCredential() {
  const token = randomToken();
  return { token, sessionId: tokenHash(token) };
}
