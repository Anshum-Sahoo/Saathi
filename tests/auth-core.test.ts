import assert from "node:assert/strict";
import { test } from "node:test";
import type { Auth } from "firebase-admin/auth";
import { createOneTimeCode, hashPin, protectedCode, tokenHash, verifyPin } from "../src/lib/auth/crypto.ts";
import { verifyFirebaseIdToken } from "../src/lib/auth/firebase-token.ts";
import { canPerform, defaultPermissions, isAllowedPermissionSet } from "../src/lib/auth/permissions.ts";
import { createSessionCredential, isSessionActive, sessionLifetimes } from "../src/lib/auth/session-policy.ts";
import { memberIdForFirebaseUid } from "../src/lib/auth/member-id.ts";
import type { MemberPermissions, MemberRole } from "../src/lib/auth/types";

const pinPepper = "unit-test-only-do-not-reuse-this-pepper";
const pairPepper = "unit-test-only-pairing-pepper-do-not-reuse";

test("pairing code uses the ten-character Crockford alphabet and stores a keyed digest", () => {
  const code = createOneTimeCode();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{10}$/);
  const digest = protectedCode(code, pairPepper);
  assert.equal(digest.length, 64);
  assert.notEqual(digest, code);
  assert.equal(protectedCode(code.toLowerCase(), pairPepper), digest);
  assert.notEqual(protectedCode(code, `${pairPepper}x`), digest);
});

test("elder PIN is salted, peppered, and verified without plaintext storage", async () => {
  const [first, second] = await Promise.all([hashPin("1234", pinPepper), hashPin("1234", pinPepper)]);
  assert.notEqual(first, "1234");
  assert.notEqual(first, second);
  assert.equal(await verifyPin("1234", first, pinPepper), true);
  assert.equal(await verifyPin("9876", first, pinPepper), false);
  assert.equal(await verifyPin("1234", first, `${pinPepper}x`), false);
});

test("session validity enforces idle and absolute expiry", () => {
  assert.equal(isSessionActive(200, 300, 100), true);
  assert.equal(isSessionActive(100, 300, 100), false);
  assert.equal(isSessionActive(200, 100, 100), false);
  assert.equal(isSessionActive(200, undefined, 100), true);
});

test("session creation uses an opaque token with adult absolute and elder sliding lifetimes", () => {
  const credentials = createSessionCredential();
  assert.equal(credentials.token.length, 43);
  assert.equal(credentials.sessionId.length, 64);
  assert.notEqual(credentials.token, credentials.sessionId);
  const adult = sessionLifetimes("member", 1_000);
  assert.equal(adult.idleExpiresAt - 1_000, 12 * 60 * 60_000);
  assert.equal(adult.absoluteExpiresAt! - 1_000, 7 * 24 * 60 * 60_000);
  const elder = sessionLifetimes("elder_device", 1_000);
  assert.equal(elder.idleExpiresAt - 1_000, 30 * 24 * 60 * 60_000);
  assert.equal(elder.absoluteExpiresAt, undefined);
});

test("adult member document IDs are stable without storing a Firebase UID in the path", () => {
  const id = memberIdForFirebaseUid("firebase-user-123");
  assert.equal(id.length, 64);
  assert.equal(memberIdForFirebaseUid("firebase-user-123"), id);
  assert.notEqual(id, "firebase-user-123");
});

test("Firebase ID token verifier always asks Admin to check revocation", async () => {
  let checkRevoked = false;
  const auth = {
    verifyIdToken: async (_token: string, check: boolean) => {
      checkRevoked = check;
      return { uid: "test-user" };
    },
  } as unknown as Pick<Auth, "verifyIdToken">;
  const identity = await verifyFirebaseIdToken(auth, "not-a-real-token");
  assert.equal(identity.uid, "test-user");
  assert.equal(checkRevoked, true);
});

test("authorization matrix keeps family and emergency contacts read-limited", () => {
  const roles: Exclude<MemberRole, "elder">[] = ["caregiver", "family", "emergency_contact"];
  const permissions = Object.fromEntries(roles.map((role) => [role, defaultPermissions(role, true)])) as Record<Exclude<MemberRole, "elder">, MemberPermissions>;
  assert.equal(canPerform("caregiver", permissions.caregiver, "editMedications"), true);
  assert.equal(canPerform("family", permissions.family, "editMedications"), false);
  assert.equal(canPerform("emergency_contact", permissions.emergency_contact, "viewHistory"), false);
  assert.equal(canPerform("elder", defaultPermissions("caregiver", true), "careSignal"), true);
  assert.equal(canPerform("elder", defaultPermissions("caregiver", true), "manageCircle"), false);
  assert.equal(canPerform("elder", defaultPermissions("caregiver", true), "manageCircle", true), true);
});

test("only role-approved permissions can be granted", () => {
  const family = defaultPermissions("family");
  assert.equal(isAllowedPermissionSet("family", family), true);
  assert.equal(isAllowedPermissionSet("family", { ...family, editMedications: true }), false);
  assert.equal(isAllowedPermissionSet("caregiver", { ...defaultPermissions("caregiver"), manageCircle: true }), true);
  assert.equal(tokenHash("opaque-session-token").length, 64);
  assert.notEqual(tokenHash("opaque-session-token"), "opaque-session-token");
});
