import "server-only";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ApiError } from "./http";

export function requireFirestore() {
  const db = getAdminFirestore();
  if (!db) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Care-circle services are not configured yet.");
  return db;
}
