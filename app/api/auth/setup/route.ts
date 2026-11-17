import { NextResponse } from "next/server";
import { route, HttpError, withSession } from "@/lib/api";
import { secretEquals } from "@/lib/crypto";
import { adoptOrphans, countUsers, createUser, normUsername, publicUser, validate } from "@/lib/users";

/** First-run only: creates the admin. Needs the APP_PASSWORD from the server environment as a setup key. */
export const POST = route(async (req) => {
  const b = await req.json();
  if (!process.env.APP_PASSWORD) throw new HttpError(500, "APP_PASSWORD (setup key) is not set on the server");
  if ((await countUsers()) > 0) throw new HttpError(403, "Setup is already done");
  if (!secretEquals(String(b.setup_key ?? ""), process.env.APP_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800));
    throw new HttpError(401, "Wrong setup key");
  }
  const username = normUsername(b.username), password = String(b.password ?? "");
  const bad = validate(username, password);
  if (bad) throw new HttpError(400, bad);
  const u = await createUser(username, password, true, true);
  if (!u) throw new HttpError(403, "Setup is already done");
  await adoptOrphans(u.id);
  return withSession(NextResponse.json({ user: publicUser(u) }), u);
}, { public: true });
