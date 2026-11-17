import { NextResponse } from "next/server";
import { route, HttpError, withSession } from "@/lib/api";
import { verifyPassword } from "@/lib/crypto";
import { getUser, setPassword, validate } from "@/lib/users";

export const POST = route(async (req, _p, user) => {
  const b = await req.json();
  if (!(await verifyPassword(String(b.current ?? ""), user.pw_hash))) throw new HttpError(401, "Current password is wrong");
  const bad = validate(user.username, String(b.next ?? ""));
  if (bad) throw new HttpError(400, bad);
  await setPassword(user.id, String(b.next));
  return withSession(NextResponse.json({ ok: true }), (await getUser(user.id))!);   // keep this browser signed in
});
