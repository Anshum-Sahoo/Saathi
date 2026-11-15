import "server-only";
import { getAdminAuth } from "@/lib/firebase/admin";
import { ApiError, getBearerToken } from "@/lib/server/http";
import { getAuthContext, isElevated, type AuthContext } from "./sessions";
import { canPerform, type CircleAction } from "./permissions";
import { requireFirestore } from "@/lib/server/firestore";
import { verifyFirebaseIdToken } from "./firebase-token";

export async function verifyFirebaseIdentity(request: Request) {
  const auth = getAdminAuth();
  if (!auth) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Authentication is not configured yet.");
  try {
    return await verifyFirebaseIdToken(auth, getBearerToken(request));
  } catch {
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
}

export async function requireContext(request: Request): Promise<AuthContext> {
  const context = await getAuthContext(request, requireFirestore());
  if (!context) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return context;
}

export async function requireAction(request: Request, action: CircleAction): Promise<AuthContext> {
  const context = await requireContext(request);
  if (!canPerform(context.member.role, context.member.permissions, action, isElevated(context))) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to do that.");
  }
  return context;
}

export async function requireSameCircleResource(context: AuthContext, collection: string, id: string) {
  const ref = requireFirestore().collection(collection).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.circleId !== context.circleId) {
    throw new ApiError(404, "NOT_FOUND", "This item could not be found.");
  }
  return { ref, snapshot };
}

export function requireElevatedElder(context: AuthContext) {
  if (context.member.role !== "elder" || !isElevated(context)) {
    throw new ApiError(403, "STEP_UP_REQUIRED", "Enter your PIN to continue.");
  }
}
