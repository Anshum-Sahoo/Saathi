import { FieldValue } from "firebase-admin/firestore";
import { requireContext } from "@/lib/auth/guard";
import { ensureDocumentId } from "@/lib/care/firestore";
import { apiRoute, ApiError, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ read: z.literal(true) }).strict();
type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = apiRoute(async (request: Request, route: RouteContext) => {
  requireOrigin(request);
  const context = await requireContext(request);
  await readJson(request, schema);
  const { id } = await route.params;
  ensureDocumentId(id);
  const ref = requireFirestore().collection("notifications").doc(id);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!snapshot.exists || data?.circleId !== context.circleId || data?.memberId !== context.memberId || data?.channel !== "in_app") {
    throw new ApiError(404, "NOT_FOUND", "This notification could not be found.");
  }
  if (!data.readAt) await ref.update({ readAt: FieldValue.serverTimestamp() });
  return Response.json({ id, read: true }, { headers: { "Cache-Control": "no-store" } });
});
