export type CareSignal = "ok" | "not_yet";

export function doseSignalDecision(input: {
  state: string;
  scheduledAt: number;
  snoozedUntil?: number;
  signal: CareSignal;
  now: number;
}): "confirm" | "snooze" | "replay" | "invalid" {
  if (input.signal === "not_yet" && input.state === "snoozed" && input.snoozedUntil && input.snoozedUntil > input.now) return "replay";
  if (input.signal === "ok") return ["scheduled", "reminded", "snoozed", "unconfirmed", "needs_help"].includes(input.state) && input.scheduledAt <= input.now + 60 * 60_000 ? "confirm" : "invalid";
  return ["scheduled", "reminded", "snoozed"].includes(input.state) && input.scheduledAt <= input.now ? "snooze" : "invalid";
}

export function alertClaimDecision(input: { status: string; claimedBy?: string; memberId: string; isNotified: boolean }): "claim" | "owned" | "taken" | "closed" | "forbidden" {
  if (!input.isNotified) return "forbidden";
  if (input.status === "claimed" && input.claimedBy === input.memberId) return "owned";
  if (input.status === "claimed" && input.claimedBy) return "taken";
  return input.status === "open" ? "claim" : "closed";
}
