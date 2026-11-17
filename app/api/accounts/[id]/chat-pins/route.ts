import { route, HttpError } from "@/lib/api";
import { setChatPin } from "@/lib/archive";
import { getAccount } from "@/lib/store";

/* Pinned conversations are an app feature stored in our database. Telegram's own pinned chats are not touched. */
async function keyOf(id: string) {
  const key = (await getAccount(id))?.me?.id;
  if (!key) throw new HttpError(409, "Open the account once before pinning");
  return key;
}

export const POST = route(async (req, { id }) => {
  const b = await req.json();
  if (!b.c) throw new HttpError(400, "Missing chat");
  await setChatPin(await keyOf(id), String(b.c), true);
  return { ok: true };
});

export const DELETE = route(async (req, { id }) => {
  const c = req.nextUrl.searchParams.get("c");
  if (!c) throw new HttpError(400, "Missing chat");
  await setChatPin(await keyOf(id), c, false);
  return { ok: true };
});
