import { createHmac, createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function deriveScrypt(input: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(input, salt, 32, { N: 16384, r: 8, p: 5, maxmem: 128 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function protectedCode(code: string, pepper = process.env.PAIRING_CODE_PEPPER): string {
  if (!pepper) throw new Error("PAIRING_CODE_PEPPER is not configured");
  return createHmac("sha256", pepper).update(normalizeCode(code)).digest("hex");
}

export function createOneTimeCode(): string {
  let value = BigInt(`0x${randomBytes(7).toString("hex")}`) & ((1n << 50n) - 1n);
  let code = "";
  for (let i = 0; i < 10; i += 1) {
    code = CROCKFORD[Number(value & 31n)] + code;
    value >>= 5n;
  }
  return code;
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

export async function hashPin(pin: string, pepper = process.env.ELDER_PIN_PEPPER): Promise<string> {
  if (!pepper) throw new Error("ELDER_PIN_PEPPER is not configured");
  const salt = randomBytes(16);
  const input = createHmac("sha256", pepper).update(pin).digest();
  const derived = await deriveScrypt(input, salt);
  return `scrypt$N=16384,r=8,p=5$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPin(pin: string, encoded: string, pepper = process.env.ELDER_PIN_PEPPER): Promise<boolean> {
  if (!pepper) throw new Error("ELDER_PIN_PEPPER is not configured");
  const [, parameters, saltHex, hashHex] = encoded.split("$");
  if (parameters !== "N=16384,r=8,p=5" || !/^[a-f0-9]{32}$/.test(saltHex ?? "") || !/^[a-f0-9]{64}$/.test(hashHex ?? "")) return false;
  const input = createHmac("sha256", pepper).update(pin).digest();
  const derived = await deriveScrypt(input, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(derived, Buffer.from(hashHex, "hex"));
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
