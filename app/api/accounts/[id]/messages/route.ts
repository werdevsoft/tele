import { route } from "@/lib/api";
import { archive, deletedCount, deletedInWindow, editedHistory, MAX_ID, pinnedIds } from "@/lib/archive";
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
  const around = Number(q.get("around")) || 0;     // load a window centred on this message id (jump to a pin)
  const peer = peerFrom(q);

  return withClient(id, async (c, a) => {
    const opts: any = { limit };
    if (before) opts.offsetId = before;
    if (around) { opts.offsetId = around + 1; opts.addOffset = -Math.floor(limit / 2); }
    if (search) opts.search = search;
    const raw: any[] = [...(await c.getMessages(peer, opts))];
    let items: any[] = raw.filter((m) => m.className === "Message").map(serializeMessage).reverse();
    const has_more = raw.length === limit;
    const lo = has_more && raw.length ? Math.min(...raw.map((m) => m.id)) : 0;
    const hi = around && raw.length ? Math.max(...raw.map((m) => m.id)) : before ? before - 1 : MAX_ID;

    let deleted_count = 0, archived = false, pins: number[] = [];
    if (archiveEnabled && chat) {
      try {
        const key = await archiveKey(c, a);
        archived = !!key;
        if (!search) {
          await archive(key, chat, items, items.length ? { lo, hi } : undefined);
          // deleted messages stay in the list (as collapsed stubs in the UI); edited ones carry their old versions
          const gone = await deletedInWindow(key, chat, lo, hi);
          const hist = await editedHistory(key, chat, items.filter((m) => m.edited).map((m) => m.id));
          items = items.map((m) => (hist[m.id] ? { ...m, history: hist[m.id] } : m));
          const live = new Set(items.map((m) => m.id));
          items = [...items, ...gone.filter((g) => !live.has(g.id))].sort((x, y) => x.id - y.id);
        }
        deleted_count = await deletedCount(key, chat);
        pins = await pinnedIds(key, chat);
      } catch (e) { console.error("archive failed:", e); archived = false; }
    }
    return { messages: items, has_more, lo, deleted_count, archive: archived, pins };
  });
});
