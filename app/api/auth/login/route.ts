import { NextResponse } from "next/server";
import { route, HttpError, withSession } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { clearFailures, findByUsername, normUsername, publicUser, recordFailure } from "@/lib/users";

let dummy: Promise<string> | null = null;   // so unknown usernames cost the same time as wrong passwords

export const POST = route(async (req) => {
  const b = await req.json();
  const u = await findByUsername(normUsername(b.username));
  const pw = String(b.password ?? "");
  if (!u) {
    await verifyPassword(pw, await (dummy ??= hashPassword("dummy-password")));
    throw new HttpError(401, "Wrong username or password");
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(u.locked_until).getTime() - Date.now()) / 60000);
    throw new HttpError(429, `Too many wrong passwords. Try again in ${mins} min.`);
  }
  if (!(await verifyPassword(pw, u.pw_hash))) {
    await recordFailure(u.id);
    throw new HttpError(401, "Wrong username or password");
  }
  await clearFailures(u.id);
  return withSession(NextResponse.json({ user: publicUser(u) }), u);
}, { public: true });
