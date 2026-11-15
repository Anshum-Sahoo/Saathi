import "server-only";
import { createHmac } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ApiError } from "./http";

export async function enforceRateLimit(db: Firestore, key: string, maximum: number, windowMs: number) {
  const pepper = process.env.PAIRING_CODE_PEPPER;
  if (!pepper) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Security settings are not configured yet.");
  const id = createHmac("sha256", pepper).update(key).digest("hex");
  const ref = db.collection("rateLimits").doc(id);
  const now = Date.now();
  let limited = false;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const value = snapshot.data();
    const windowStart = value?.windowStart;
    const active = Boolean(windowStart && windowStart.toMillis() > now - windowMs);
    if ((value?.lockedUntil?.toMillis() ?? 0) > now) { limited = true; return; }
    const count = active ? Number(value?.count ?? 0) : 0;
    if (count >= maximum) {
      const lockedUntil = Timestamp.fromMillis(now + windowMs);
      transaction.set(ref, { count, windowStart: windowStart ?? Timestamp.fromMillis(now), lockedUntil, expireAt: lockedUntil });
      limited = true;
      return;
    }
    transaction.set(ref, {
      count: count + 1,
      windowStart: active && windowStart ? windowStart : Timestamp.fromMillis(now),
      expireAt: Timestamp.fromMillis(now + windowMs),
    });
  });
  if (limited) throw new ApiError(429, "RATE_LIMITED", "Too many tries. Please wait before trying again.");
}

export async function enforceIpLimit(request: Request, db: Firestore, scope: string, maximum = 10, windowMs = 10 * 60_000) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip") ?? forwarded ?? "unknown";
  await enforceRateLimit(db, `ip:${scope}:${ip}`, maximum, windowMs);
}
