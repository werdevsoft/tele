import { route } from "@/lib/api";
import { archive, deletedCount, deletedInWindow, editedHistory, MAX_ID } from "@/lib/archive";
import { archiveEnabled } from "@/lib/db";
import { archiveKey, peerFrom, serializeMessage, withClient } from "@/lib/tg";

export const maxDuration = 30;

// getMessages never marks anything as read (that needs an explicit readHistory call).
export const GET = route(async (req, { id }) => {
  const q = req.nextUrl.searchParams;
  const limit = Math.min(100, Number(q.get("limit")) || 40);
  const chat = q.get("c") || "";
  const before = Number(q.get("before")) || 0;
  const search = q.get("q");
  const showDeleted = q.get("deleted") === "1";
  const peer = peerFrom(q);

  return withClient(id, async (c, a) => {
    const opts: any = { limit };
    if (before) opts.offsetId = before;
    if (search) opts.search = search;
    const raw: any[] = [...(await c.getMessages(peer, opts))];
    let items: any[] = raw.filter((m) => m.className === "Message").map(serializeMessage).reverse();
    const has_more = raw.length === limit;
    const lo = has_more && raw.length ? Math.min(...raw.map((m) => m.id)) : 0;
    const hi = before ? before - 1 : MAX_ID;

    let deleted_count = 0, archived = false;
    if (archiveEnabled && chat) {
      try {
        const key = await archiveKey(c, a);
        archived = !!key;
        if (!search) {
          await archive(key, chat, items, items.length ? { lo, hi } : undefined);
          if (showDeleted) {
            const gone = await deletedInWindow(key, chat, lo, hi);
            const hist = await editedHistory(key, chat, items.filter((m) => m.edited).map((m) => m.id));
            items = items.map((m) => (hist[m.id] ? { ...m, history: hist[m.id] } : m));
            items = [...items, ...gone].sort((x, y) => x.id - y.id);
          }
        }
        deleted_count = await deletedCount(key, chat);
      } catch (e) { console.error("archive failed:", e); archived = false; }
    }
    return { messages: items, has_more, lo, deleted_count, archive: archived };
  });
});
