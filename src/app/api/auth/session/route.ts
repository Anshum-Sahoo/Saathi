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

function logExchangeFailure(stage: string, error: unknown) {
  const rawCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
  const code = rawCode && /^[a-zA-Z0-9_./-]{1,80}$/.test(rawCode) ? rawCode : undefined;
  console.error("SAATHI session exchange failed", {
    stage,
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(code ? { errorCode: code } : {}),
  });
}

export const POST = apiRoute(async (request) => {
  let stage = "origin_validation";
  try {
    requireOrigin(request);
    stage = "firebase_admin_initialization";
    const auth = getAdminAuth();
    if (!auth) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Authentication is not configured yet.");
    stage = "firestore_initialization";
    const db = requireFirestore();
    stage = "rate_limit";
    await enforceIpLimit(request, db, "session-bootstrap", 10);
    stage = "firebase_id_token_verification";
    const bearer = getBearerToken(request);
    let decoded;
    try { decoded = await verifyFirebaseIdToken(auth, bearer); }
    catch (error) {
      logExchangeFailure(stage, error);
      throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    stage = "member_lookup";
    const memberDoc = await db.collection("members").doc(memberIdForFirebaseUid(decoded.uid)).get();
    if (!memberDoc.exists || memberDoc.data()?.status !== "active") throw new ApiError(403, "FORBIDDEN", "This account has not joined a care circle yet.");
    const member = memberDoc.data() as MemberRecord;
    stage = "session_persistence";
    const session = await issueSession(db, memberDoc.id, member, "member");
    stage = "cookie_issuance";
    const headers = new Headers({ "Cache-Control": "no-store" });
    setSessionCookie(headers, session.token, session.expiresAt);
    return Response.json({ member: { id: memberDoc.id, displayName: member.displayName, role: member.role } }, { headers });
  } catch (error) {
    if (!(error instanceof ApiError)) logExchangeFailure(stage, error);
    throw error;
  }
});
