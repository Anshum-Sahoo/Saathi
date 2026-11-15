import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message);
  }
}

export function logApiFailure(route: string, stage: string, error: unknown): void {
  if (error instanceof ApiError) return;
  const rawCode = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  const code = (typeof rawCode === "string" || typeof rawCode === "number") && /^[a-zA-Z0-9_./-]{1,80}$/.test(String(rawCode))
    ? String(rawCode)
    : null;
  const normalized = code?.toLowerCase();
  const errorCategory = normalized === "9" || normalized?.includes("failed-precondition") ? "failed_precondition_or_missing_index"
    : normalized === "7" || normalized?.includes("permission-denied") ? "permission_denied"
    : normalized === "3" || normalized?.includes("invalid-argument") ? "invalid_argument"
    : normalized === "5" || normalized?.includes("not-found") ? "not_found"
    : normalized === "4" || normalized === "8" || normalized === "14" || normalized?.includes("unavailable") || normalized?.includes("deadline-exceeded") || normalized?.includes("resource-exhausted") ? "transient_service_failure"
    : normalized === "13" || normalized?.includes("internal") ? "firebase_internal"
    : "application_or_unknown";
  const rawName = error instanceof Error ? error.name : "UnknownError";
  const errorName = /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(rawName) ? rawName : "UnknownError";
  console.error("SAATHI API request failed", { route, stage, errorName, firebaseErrorCode: code, errorCategory });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
  }
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", details: {} } }, { status: 500 });
}

export function apiRoute(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response>;
export function apiRoute<TContext>(handler: (request: Request, context: TContext) => Promise<Response>): (request: Request, context: TContext) => Promise<Response>;
export function apiRoute(handler: (request: Request, context?: unknown) => Promise<Response>) {
  return async (request: Request, context?: unknown): Promise<Response> => {
    try { return await handler(request, context); }
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
