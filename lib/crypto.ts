import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

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
export function makeToken(days = 30): string {
  const exp = String(Date.now() + days * 864e5);
  return `${exp}.${sign(exp)}`;
}
export function checkToken(t?: string): boolean {
  if (!t) return false;
  const [exp, sig] = t.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}
export function passwordOk(input: string): boolean {
  const p = process.env.APP_PASSWORD;
  if (!p) return false;
  const a = createHash("sha256").update(input).digest(), b = createHash("sha256").update(p).digest();
  return timingSafeEqual(a, b);
}
