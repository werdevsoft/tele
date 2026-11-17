import { route, HttpError } from "@/lib/api";
import { createUser, listUsers, normUsername, findByUsername, validate } from "@/lib/users";

export const GET = route(async () => listUsers(), { admin: true });

export const POST = route(async (req) => {
  const b = await req.json();
  const username = normUsername(b.username), password = String(b.password ?? "");
  const bad = validate(username, password);
  if (bad) throw new HttpError(400, bad);
  if (await findByUsername(username)) throw new HttpError(409, "That username is taken");
  const u = await createUser(username, password, false);
  return { id: u!.id, username: u!.username, is_admin: false, accounts: 0 };
}, { admin: true });
