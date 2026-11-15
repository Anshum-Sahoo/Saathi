import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
  }
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", details: {} } }, { status: 500 });
}

export function apiRoute(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try { return await handler(request); }
    catch (error) { return errorResponse(error); }
  };
}

export function requireOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).origin : new URL(request.url).origin;
  if (!origin || origin !== expected) throw new ApiError(403, "FORBIDDEN", "This request could not be verified.");
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA", "Send JSON data.");
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 16_384) throw new ApiError(413, "FILE_TOO_LARGE", "The request is too large.");
    body = JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "VALIDATION_ERROR", "The request body is not valid JSON.");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, "VALIDATION_ERROR", "Check the information and try again.", { fields: result.error.issues.map((issue) => issue.path.join(".")) });
  return result.data;
}

export function getBearerToken(request: Request): string {
  const value = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return match[1];
}
