import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ApiError } from "@/lib/server/http";
import { verifyPin } from "./crypto";

export async function verifyElderPin(db: Firestore, memberId: string, pin: string, pinHash: string): Promise<void> {
  if (!process.env.ELDER_PIN_PEPPER) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Elder PIN security is not configured yet.");
  const ref = db.collection("rateLimits").doc(`pin_${memberId}`);
  const now = Date.now();
  const windowMs = 15 * 60_000;
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    const value = current.data();
    if ((value?.lockedUntil?.toMillis() ?? 0) > now) throw new ApiError(429, "RATE_LIMITED", "Too many tries. Please wait before trying again.");
    const windowStart = value?.windowStart;
    const active = Boolean(windowStart && windowStart.toMillis() > now - windowMs);
    const count = active ? Number(value?.count ?? 0) : 0;
    if (count >= 5) throw new ApiError(429, "RATE_LIMITED", "Too many tries. Please wait before trying again.");
    const nextCount = count + 1;
    const lockedUntil = nextCount >= 5 ? Timestamp.fromMillis(now + windowMs) : undefined;
    transaction.set(ref, {
      count: nextCount,
      windowStart: active && windowStart ? windowStart : Timestamp.fromMillis(now),
      ...(lockedUntil ? { lockedUntil, expireAt: lockedUntil } : { expireAt: Timestamp.fromMillis(now + windowMs) }),
    });
  });
  if (await verifyPin(pin, pinHash)) {
    await ref.delete();
    return;
  }
  throw new ApiError(401, "UNAUTHENTICATED", "That PIN did not match.");
}
