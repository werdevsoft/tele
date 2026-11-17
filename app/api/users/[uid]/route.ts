import { route, HttpError } from "@/lib/api";
import { deleteUser, getUser, setPassword, validate } from "@/lib/users";

export const PATCH = route(async (req, { uid }) => {
  const b = await req.json();
  const target = await getUser(uid);
  if (!target) throw new HttpError(404, "User not found");
  const bad = validate(target.username, String(b.password ?? ""));
  if (bad) throw new HttpError(400, bad);
  await setPassword(uid, String(b.password));      // also signs that user out everywhere
  return { ok: true };
}, { admin: true });

export const DELETE = route(async (_req, { uid }, me) => {
  if (uid === me.id) throw new HttpError(400, "You can't remove yourself");
  if (!(await getUser(uid))) throw new HttpError(404, "User not found");
  await deleteUser(uid);
  return { ok: true };
}, { admin: true });
