import { getAdminAuth } from "@/lib/firebase/admin";
import { issueSession, setSessionCookie } from "@/lib/auth/sessions";
import { ApiError, apiRoute, getBearerToken, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import type { MemberRecord } from "@/lib/auth/types";
import { enforceIpLimit } from "@/lib/server/rate-limit";
import { verifyFirebaseIdToken } from "@/lib/auth/firebase-token";
import { memberIdForFirebaseUid } from "@/lib/auth/member-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const auth = getAdminAuth();
  if (!auth) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Authentication is not configured yet.");
  let decoded;
  try { decoded = await verifyFirebaseIdToken(auth, getBearerToken(request)); }
  catch { throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue."); }

  const db = requireFirestore();
  await enforceIpLimit(request, db, "session-bootstrap", 10);
  const memberDoc = await db.collection("members").doc(memberIdForFirebaseUid(decoded.uid)).get();
  if (!memberDoc.exists || memberDoc.data()?.status !== "active") throw new ApiError(403, "FORBIDDEN", "This account has not joined a care circle yet.");
  const member = memberDoc.data() as MemberRecord;
  const session = await issueSession(db, memberDoc.id, member, "member");
  const headers = new Headers({ "Cache-Control": "no-store" });
  setSessionCookie(headers, session.token, session.expiresAt);
  return Response.json({ member: { id: memberDoc.id, displayName: member.displayName, role: member.role } }, { headers });
});
