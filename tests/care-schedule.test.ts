import assert from "node:assert/strict";
import { test } from "node:test";
import { doseUiState, dosesForDate, localDateInZone, localTimeToUtc } from "../src/lib/care/schedule.ts";
import { alertClaimDecision, doseSignalDecision } from "../src/lib/care/transitions.ts";
import { safeDate } from "../src/lib/server/safe-date.ts";

test("fixed clock times use the circle's IANA timezone and deterministic occurrence IDs", () => {
  const medication = {
    id: "med_abc", name: "Example medication", label: "With breakfast", instructionText: "Caregiver-entered note",
    times: ["09:00", "21:00"], daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-11-15", endDate: null,
  };
  const doses = dosesForDate([medication], "2026-11-15", "Asia/Kolkata");
  assert.deepEqual(doses.map((dose) => dose.id), ["med_med_abc_20261115T0900", "med_med_abc_20261115T2100"]);
  assert.equal(doses[0].scheduledAt.toISOString(), "2026-11-15T03:30:00.000Z");
  assert.equal(doses[1].scheduledAt.toISOString(), "2026-11-15T15:30:00.000Z");
  assert.deepEqual(dosesForDate([medication], "2026-11-15", "Asia/Kolkata"), doses);
});

test("local date selection and scheduled clocks handle day boundaries and daylight saving", () => {
  assert.equal(localDateInZone(new Date("2026-11-15T20:00:00Z"), "Asia/Kolkata"), "2026-11-16");
  assert.equal(localTimeToUtc("2026-11-01", "09:00", "America/New_York").toISOString(), "2026-11-01T14:00:00.000Z");
});

test("Firestore timestamps map safely and malformed values are omitted", () => {
  const expected = new Date("2026-11-15T04:00:00.000Z");
  assert.equal(safeDate(expected)?.toISOString(), expected.toISOString());
  assert.equal(safeDate({ toDate: () => expected })?.toISOString(), expected.toISOString());
  assert.equal(safeDate({ toDate: () => { throw new Error("bad timestamp"); } }), undefined);
  assert.equal(safeDate("not a timestamp"), undefined);
});

test("medication day and date limits are respected", () => {
  const medication = { id: "med_x", name: "Example", label: "Note", instructionText: "", times: ["08:00"], daysOfWeek: [1], startDate: "2026-11-16", endDate: "2026-11-23" };
  assert.equal(dosesForDate([medication], "2026-11-15", "UTC").length, 0);
  assert.equal(dosesForDate([medication], "2026-11-16", "UTC").length, 1);
  assert.equal(dosesForDate([medication], "2026-11-23", "UTC").length, 1);
  assert.equal(dosesForDate([medication], "2026-11-24", "UTC").length, 0);
});

test("no response is unconfirmed and a snooze stays pending until its persisted time", () => {
  const now = new Date("2026-11-15T04:00:00Z");
  assert.equal(doseUiState({ state: "scheduled", scheduledAt: new Date("2026-11-15T03:30:00Z") }, now), "unconfirmed");
  assert.equal(doseUiState({ state: "snoozed", scheduledAt: new Date("2026-11-15T03:30:00Z"), snoozedUntil: new Date("2026-11-15T04:15:00Z") }, now), "snoozed");
  assert.equal(doseUiState({ state: "snoozed", scheduledAt: new Date("2026-11-15T03:30:00Z"), snoozedUntil: new Date("2026-11-15T03:45:00Z") }, now), "unconfirmed");
});

test("Care Signals enforce the one-hour early window and 15-minute snooze replay", () => {
  const now = Date.parse("2026-11-15T04:00:00Z");
  assert.equal(doseSignalDecision({ state: "scheduled", scheduledAt: now + 61 * 60_000, signal: "ok", now }), "invalid");
  assert.equal(doseSignalDecision({ state: "scheduled", scheduledAt: now + 60 * 60_000, signal: "ok", now }), "confirm");
  assert.equal(doseSignalDecision({ state: "scheduled", scheduledAt: now + 1, signal: "not_yet", now }), "invalid");
  assert.equal(doseSignalDecision({ state: "scheduled", scheduledAt: now - 1, signal: "not_yet", now }), "snooze");
  assert.equal(doseSignalDecision({ state: "snoozed", scheduledAt: now - 1, snoozedUntil: now + 15 * 60_000, signal: "not_yet", now }), "replay");
  assert.equal(doseSignalDecision({ state: "unconfirmed", scheduledAt: now - 1, signal: "not_yet", now }), "invalid");
});

test("claim policy has one named owner and only notified active helpers may claim", () => {
  const current = { status: "open", memberId: "helper-a", isNotified: true };
  assert.equal(alertClaimDecision(current), "claim");
  assert.equal(alertClaimDecision({ status: "claimed", claimedBy: "helper-a", memberId: "helper-a", isNotified: true }), "owned");
  assert.equal(alertClaimDecision({ status: "claimed", claimedBy: "helper-a", memberId: "helper-b", isNotified: true }), "taken");
  assert.equal(alertClaimDecision({ status: "open", memberId: "helper-c", isNotified: false }), "forbidden");
  assert.equal(alertClaimDecision({ status: "resolved", memberId: "helper-a", isNotified: true }), "closed");
});
