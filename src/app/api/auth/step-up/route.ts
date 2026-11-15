import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { verifyElderPin } from "@/lib/auth/pin";
import { requireContext } from "@/lib/auth/guard";
import { ApiError, apiRoute, readJson, requireOrigin } from "@/lib/server/http";
import { requireFirestore } from "@/lib/server/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ pin: z.string().regex(/^\d{4,6}$/) }).strict();

export const POST = apiRoute(async (request) => {
  requireOrigin(request);
  const context = await requireContext(request);
  if (context.member.role !== "elder" || !context.member.pinHash) throw new ApiError(403, "FORBIDDEN", "PIN verification is available on the elder device.");
  const { pin } = await readJson(request, schema);
  const db = requireFirestore();
  await verifyElderPin(db, context.memberId, pin, context.member.pinHash);
  const elevatedUntil = Timestamp.fromMillis(Date.now() + 5 * 60_000);
  await db.collection("sessions").doc(context.sessionId).update({ elevatedUntil });
  return Response.json({ elevatedUntil: elevatedUntil.toDate().toISOString() }, { headers: { "Cache-Control": "no-store" } });
});
