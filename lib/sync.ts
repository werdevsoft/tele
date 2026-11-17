import type { TelegramClient } from "telegram";
import type { Api } from "telegram";
import { archive, markSynced, MAX_ID } from "./archive";
import { serializeMessage } from "./tg";

/** Messages kept per chat by automatic saving. The manual "save full history" button has no cap. */
export const AUTO_LIMIT = 3000;

export type SyncResult = { saved: number; done: boolean; next_before: number | null; capped: boolean };

/**
 * Copies a chat into the archive and flags what disappeared.
 *  - "recent": one page (newest 100). Cheap; catches new messages and recent deletions.
 *  - "full":   backfills newest to oldest from `before` (resumable), until the history ends, `limit` messages
 *              are saved, or the time budget runs out (then it returns the cursor to continue from).
 */
export async function syncChat(
  c: TelegramClient, key: string, chat: string, peer: Api.TypeInputPeer,
  o: { mode: "recent" | "full"; before?: number; limit?: number; budgetMs?: number },
): Promise<SyncResult> {
  const started = Date.now();
  let before = o.before || 0, saved = 0, capped = false, newest: number | undefined;
  const limit = o.limit ?? Infinity;

  while (true) {
    const raw: any[] = [...(await c.getMessages(peer, { limit: 100, ...(before ? { offsetId: before } : {}) }))];
    if (!raw.length) { await markSynced(key, chat, { full: o.mode === "full", cursor: null }); return { saved, done: true, next_before: null, capped }; }
    const items = raw.filter((m) => m.className === "Message").map(serializeMessage).reverse();
    const hasMore = raw.length === 100;
    const minId = Math.min(...raw.map((m) => m.id));
    if (!before) newest = Math.max(...raw.map((m) => m.id));
    await archive(key, chat, items, items.length ? { lo: hasMore ? minId : 0, hi: before ? before - 1 : MAX_ID } : undefined);
    saved += items.length; before = minId;

    if (o.mode === "recent") { await markSynced(key, chat, { lastId: newest }); return { saved, done: true, next_before: null, capped }; }
    if (!hasMore) { await markSynced(key, chat, { full: true, cursor: null, lastId: newest }); return { saved, done: true, next_before: null, capped }; }
    if (saved >= limit) { capped = true; await markSynced(key, chat, { full: true, cursor: null, lastId: newest }); return { saved, done: true, next_before: null, capped }; }
    if (Date.now() - started > (o.budgetMs ?? 35_000)) { await markSynced(key, chat, { cursor: before, lastId: newest }); return { saved, done: false, next_before: before, capped }; }
  }
}
