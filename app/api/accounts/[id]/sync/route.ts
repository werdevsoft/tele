import { route } from "@/lib/api";
import { archive, MAX_ID } from "@/lib/archive";
import { archiveEnabled } from "@/lib/db";
import { archiveKey, peerFrom, serializeMessage, withClient } from "@/lib/tg";
import { HttpError } from "@/lib/api";

export const maxDuration = 60;

/** Backfills a chat's history into the archive, newest to oldest, in resumable chunks. */
export const POST = route(async (req, { id }) => {
  if (!archiveEnabled) throw new HttpError(400, "Archive is off: set DATABASE_URL");
  const b = await req.json();
  const peer = peerFrom(new URLSearchParams({ t: b.t, pid: b.pid, h: b.h }));
  let before = Number(b.before) || 0;
  const started = Date.now();
  let saved = 0, done = false;

  return withClient(id, async (c, a) => {
    const key = await archiveKey(c, a);
    if (!key) throw new HttpError(500, "Could not identify the account");
    while (true) {
      const raw: any[] = [...(await c.getMessages(peer, { limit: 100, ...(before ? { offsetId: before } : {}) }))];
      if (!raw.length) { done = true; break; }
      const items = raw.filter((m) => m.className === "Message").map(serializeMessage).reverse();
      const hasMore = raw.length === 100;
      const minId = Math.min(...raw.map((m) => m.id));
      await archive(key, String(b.c), items, items.length ? { lo: hasMore ? minId : 0, hi: before ? before - 1 : MAX_ID } : undefined);
      saved += items.length; before = minId;
      if (!hasMore) { done = true; break; }
      if (Date.now() - started > 35_000) break;
    }
    return { saved, done, next_before: done ? null : before };
  });
});
