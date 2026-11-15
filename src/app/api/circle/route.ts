import { requireContext } from "@/lib/auth/guard";
import { apiRoute } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const { circle, circleId } = await requireContext(request);
  return Response.json({ circle: {
    id: circleId, elderName: circle.elderName, preferredName: circle.preferredName,
    language: circle.language, timezone: circle.timezone, status: circle.status,
  } }, { headers: { "Cache-Control": "no-store" } });
});
