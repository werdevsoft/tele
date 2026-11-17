import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new Error("APP_SECRET must be set (16+ chars).");
  return s;
}
const key = () => createHash("sha256").update("enc:" + secret()).digest();

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}
export function decrypt(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

const sign = (v: string) => createHmac("sha256", "cookie:" + secret()).update(v).digest("hex");

/** Login cookie: userId.expiry.pwTag.signature. pwTag changes when the password does, so old cookies die. */
export const pwTag = (pwHash: string) => createHash("sha256").update(pwHash).digest("hex").slice(0, 12);
export function makeToken(uid: string, tag: string, days = 30): string {
  const payload = `${uid}.${Date.now() + days * 864e5}.${tag}`;
  return `${payload}.${sign(payload)}`;
}
export function parseToken(t?: string): { uid: string; tag: string } | null {
  if (!t) return null;
  const parts = t.split(".");
  if (parts.length !== 4) return null;
  const [uid, exp, tag, sig] = parts;
  if (Number(exp) < Date.now()) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(`${uid}.${exp}.${tag}`));
  return a.length === b.length && timingSafeEqual(a, b) ? { uid, tag } : null;
}

export function secretEquals(input: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(input).digest(), b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const scryptAsync = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `s1$${salt.toString("hex")}$${(await scryptAsync(pw, salt)).toString("hex")}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [v, salt, hash] = stored.split("$");
  if (v !== "s1" || !salt || !hash) return false;
  const k = await scryptAsync(pw, Buffer.from(salt, "hex")), h = Buffer.from(hash, "hex");
  return k.length === h.length && timingSafeEqual(k, h);
}
