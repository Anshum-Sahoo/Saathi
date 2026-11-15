import { requireContext } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/sessions";
import { apiRoute } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const context = await requireContext(request);
  const headers = new Headers({ "Cache-Control": "no-store" });
  setSessionCookie(headers, context.rawToken, context.cookieExpiresAt);
  return Response.json({
    member: {
      id: context.memberId,
      displayName: context.member.displayName,
      role: context.member.role,
      tier: context.member.tier,
      permissions: context.member.permissions,
      hasPin: Boolean(context.member.pinHash),
    },
    circle: {
      id: context.circleId,
      elderName: context.circle.elderName,
      preferredName: context.circle.preferredName,
      language: context.circle.language,
      timezone: context.circle.timezone,
      status: context.circle.status,
    },
  }, { headers });
});
