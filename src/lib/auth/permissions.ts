import type { MemberPermissions, MemberRole } from "./types";

export type CircleAction =
  | "viewSchedule" | "viewHistory" | "editMedications" | "editAppointments"
  | "viewPrivateAppointments" | "receiveAlerts" | "manageCircle" | "careSignal";

export function canPerform(role: MemberRole, permissions: MemberPermissions, action: CircleAction, elevated = false): boolean {
  if (role === "elder") {
    if (["manageCircle", "editMedications", "editAppointments", "viewPrivateAppointments"].includes(action)) return elevated;
    return true;
  }
  if (action === "careSignal") return false;
  if (role === "emergency_contact") return action === "receiveAlerts" && permissions.receiveAlerts;
  return permissions[action as keyof MemberPermissions] === true;
}

export function defaultPermissions(role: Exclude<MemberRole, "elder">, primary = false): MemberPermissions {
  if (role === "caregiver") return {
    viewSchedule: true, viewHistory: true, editMedications: true, editAppointments: true,
    viewPrivateAppointments: false, receiveAlerts: true, manageCircle: primary,
  };
  if (role === "family") return {
    viewSchedule: true, viewHistory: false, editMedications: false, editAppointments: false,
    viewPrivateAppointments: false, receiveAlerts: true, manageCircle: false,
  };
  return {
    viewSchedule: false, viewHistory: false, editMedications: false, editAppointments: false,
    viewPrivateAppointments: false, receiveAlerts: true, manageCircle: false,
  };
}

export function isAllowedPermissionSet(role: MemberRole, permissions: MemberPermissions): boolean {
  if (role === "elder") return Object.values(permissions).every(Boolean);
  const allowed: Record<Exclude<MemberRole, "elder">, (keyof MemberPermissions)[]> = {
    caregiver: ["viewSchedule", "viewHistory", "editMedications", "editAppointments", "viewPrivateAppointments", "receiveAlerts", "manageCircle"],
    family: ["viewSchedule", "viewHistory", "receiveAlerts"],
    emergency_contact: ["receiveAlerts"],
  };
  return (Object.keys(permissions) as (keyof MemberPermissions)[]).every((key) => !permissions[key] || allowed[role].includes(key));
}
