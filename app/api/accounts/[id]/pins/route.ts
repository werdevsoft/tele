import { route, HttpError } from "@/lib/api";
import { addPin, archive, hasMessage, listPins, removePin } from "@/lib/archive";
import { getAccount } from "@/lib/store";
import { archiveKey, peerFrom, serializeMessage, withClient } from "@/lib/tg";

export const maxDuration = 30;

/*
 * Pins are an app feature: rows in our own database. Nothing here pins, reads or changes anything on Telegram.
 */

/** Pinned messages of this Telegram account: ?c=<chat id> for one chat, omit for all chats. */
export const GET = route(async (req, { id }) => {
  const key = (await getAccount(id))?.me?.id;
  return listPins(key, req.nextUrl.searchParams.get("c") || undefined);
});

/** Pin a message. Body: peer (t, pid, h), chat id `c`, message id `m`. */
export const POST = route(async (req, { id }) => {
  const b = await req.json();
  const chat = String(b.c || ""), msgId = Number(b.m);
  if (!chat || !msgId) throw new HttpError(400, "Missing chat or message");
  const peer = peerFrom(new URLSearchParams({ t: b.t, pid: b.pid, h: b.h }));
  return withClient(id, async (c, a) => {
    const key = await archiveKey(c, a);
    if (!key) throw new HttpError(500, "Could not identify the account");
    // make sure a copy of the message is in the archive, so the pin survives a later deletion on Telegram
    const [m]: any[] = await c.getMessages(peer, { ids: [msgId] }).catch(() => []);
    if (m?.className === "Message") await archive(key, chat, [serializeMessage(m)]);
    if (!(await hasMessage(key, chat, msgId))) throw new HttpError(404, "Message not found");
    await addPin(key, chat, msgId);
    return { ok: true };
  });
});

/** Unpin: ?c=<chat id>&m=<message id>. */
export const DELETE = route(async (req, { id }) => {
  const q = req.nextUrl.searchParams;
  const key = (await getAccount(id))?.me?.id;
  if (key && q.get("c") && q.get("m")) await removePin(key, q.get("c")!, Number(q.get("m")));
  return { ok: true };
});
