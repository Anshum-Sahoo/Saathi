import type { Timestamp } from "firebase-admin/firestore";

export type MemberRole = "elder" | "caregiver" | "family" | "emergency_contact";
export type MemberTier = "primary" | "backup" | "circle";

export type MemberPermissions = {
  viewSchedule: boolean;
  viewHistory: boolean;
  editMedications: boolean;
  editAppointments: boolean;
  viewPrivateAppointments: boolean;
  receiveAlerts: boolean;
  manageCircle: boolean;
};

export type MemberRecord = {
  circleId: string;
  role: MemberRole;
  tier: MemberTier;
  displayName: string;
  email?: string;
  emailNormalized?: string;
  firebaseUid?: string;
  pinHash?: string;
  permissions: MemberPermissions;
  status: "active" | "removed";
  createdAt: Timestamp;
  version: number;
};

export type CircleRecord = {
  elderName: string;
  preferredName: string;
  language: "en" | "hi";
  timezone: string;
  status: "pending_consent" | "active";
  createdBy: string;
  consent?: { acceptedAt: Timestamp; acceptedByMemberId: string; version: number };
  version: number;
};

export type SessionRecord = {
  memberId: string;
  circleId: string;
  role: MemberRole;
  kind: "member" | "elder_device";
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  expiresAt: Timestamp;
  absoluteExpiresAt?: Timestamp;
  elevatedUntil?: Timestamp;
  deviceLabel?: string;
};
import type { Timestamp } from "firebase-admin/firestore";
