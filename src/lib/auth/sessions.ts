import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { createSessionCredential, isSessionActive, sessionLifetimes } from "./session-policy";
import { tokenHash } from "./crypto";
import type { CircleRecord, MemberRecord, SessionRecord } from "./types";

export type AuthContext = {
  sessionId: string;
  rawToken: string;
  cookieExpiresAt: Date;
  session: SessionRecord;
  memberId: string;
  member: MemberRecord;
  circleId: string;
  circle: CircleRecord;
};

export type PreparedSession = {
  token: string;
  sessionId: string;
  expiresAt: Date;
  data: SessionRecord;
};

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-saathi_session" : "saathi_session";
}

export function prepareSession(
  memberId: string,
  member: MemberRecord,
  kind: SessionRecord["kind"],
  deviceLabel?: string,
): PreparedSession {
  const now = Date.now();
  const { token, sessionId } = createSessionCredential();
  const lifetime = sessionLifetimes(kind, now);
  const data = {
    memberId, circleId: member.circleId, role: member.role, kind,
    createdAt: Timestamp.fromMillis(now), lastSeenAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(lifetime.idleExpiresAt),
    ...(lifetime.absoluteExpiresAt ? { absoluteExpiresAt: Timestamp.fromMillis(lifetime.absoluteExpiresAt) } : {}),
    ...(deviceLabel ? { deviceLabel: deviceLabel.slice(0, 60) } : {}),
  } satisfies SessionRecord;
  return { token, sessionId, expiresAt: new Date(lifetime.cookieExpiresAt), data };
}

export async function issueSession(
  db: Firestore,
  memberId: string,
  member: MemberRecord,
  kind: SessionRecord["kind"],
  deviceLabel?: string,
): Promise<PreparedSession> {
  const session = prepareSession(memberId, member, kind, deviceLabel);
  await db.collection("sessions").doc(session.sessionId).create(session.data);
  return session;
}

export function setSessionCookie(headers: Headers, token: string, expiresAt: Date): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  headers.append("Set-Cookie", `${sessionCookieName()}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}`);
}

export function clearSessionCookie(headers: Headers): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  headers.append("Set-Cookie", `${sessionCookieName()}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`);
}

export async function getAuthContext(request: Request, db: Firestore): Promise<AuthContext | null> {
  const encodedToken = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName()}=`))?.slice(sessionCookieName().length + 1);
  if (!encodedToken) return null;
  let token: string;
  try { token = decodeURIComponent(encodedToken); } catch { return null; }
  const sessionId = tokenHash(token);
  const sessionRef = db.collection("sessions").doc(sessionId);
  const snapshot = await sessionRef.get();
  if (!snapshot.exists) return null;
  const session = snapshot.data() as SessionRecord;
  const now = Date.now();
  if (!isSessionActive(session.expiresAt.toMillis(), session.absoluteExpiresAt?.toMillis(), now)) {
    await sessionRef.delete();
    return null;
  }

  const memberRef = db.collection("members").doc(session.memberId);
  const memberSnapshot = await memberRef.get();
  if (!memberSnapshot.exists) return null;
  const member = memberSnapshot.data() as MemberRecord;
  if (member.status !== "active" || member.circleId !== session.circleId) return null;

  const circleSnapshot = await db.collection("circles").doc(member.circleId).get();
  if (!circleSnapshot.exists) return null;
  let expiresAt = session.expiresAt;
  if (session.lastSeenAt.toMillis() < now - 5 * 60_000) {
    const idleMs = session.kind === "elder_device" ? 30 * 24 * 60 * 60_000 : 12 * 60 * 60_000;
    expiresAt = Timestamp.fromMillis(now + idleMs);
    await sessionRef.update({ lastSeenAt: Timestamp.fromMillis(now), expiresAt });
  }

  return {
    sessionId,
    rawToken: token,
    cookieExpiresAt: session.kind === "elder_device" ? expiresAt.toDate() : session.absoluteExpiresAt!.toDate(),
    session: { ...session, role: member.role, expiresAt },
    memberId: memberSnapshot.id,
    member,
    circleId: member.circleId,
    circle: circleSnapshot.data() as CircleRecord,
  };
}

export function isElevated(context: AuthContext): boolean {
  return (context.session.elevatedUntil?.toMillis() ?? 0) > Date.now();
}
