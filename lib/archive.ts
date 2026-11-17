import { archiveEnabled, db, ensureSchema } from "./db";

type M = {
  id: number; date: string; out: boolean; text: string; sender: { id: string; name: string } | null;
  media: any; web: any; reply_to: number | null; edited: boolean;
};

export type ArchivedMsg = M & { deleted?: boolean; deleted_at?: string; history?: { text: string; at: string }[] };

const MAX_ID = 9_000_000_000_000_000;
export { MAX_ID };

async function upsert(key: string, entries: { chat: string; m: M }[]) {
  await ensureSchema();
  const sql = db();
  const rows = entries.map(({ chat, m }) => ({
    account_key: key, chat_id: chat, msg_id: m.id, date: m.date, out: m.out,
    sender_id: m.sender?.id ?? null, sender_name: m.sender?.name ?? null, text: m.text,
    media: m.media ? sql.json(m.media) : null, web: m.web ? sql.json(m.web) : null,
    reply_to: m.reply_to, edited: m.edited,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await sql`
      insert into messages ${sql(rows.slice(i, i + 200) as any)}
      on conflict (account_key, chat_id, msg_id) do update set
        history = case when messages.text <> '' and messages.text is distinct from excluded.text
                       then messages.history || jsonb_build_array(jsonb_build_object('text', messages.text, 'at', now()))
                       else messages.history end,
        text = excluded.text, media = excluded.media, web = excluded.web, edited = excluded.edited,
        sender_id = coalesce(excluded.sender_id, messages.sender_id),
        sender_name = coalesce(excluded.sender_name, messages.sender_name),
        last_seen = now(), deleted_at = null`;
  }
}

/** Saves one message per chat (e.g. the latest message of each dialog). No deletion detection. */
export async function archiveMany(key: string | undefined, entries: { chat: string; m: M }[]) {
  if (!archiveEnabled || !key || !entries.length) return;
  await upsert(key, entries);
}

/**
 * Saves messages from one chat. `win` is the id range that Telegram just answered for:
 * anything archived inside it that Telegram no longer returns is marked deleted.
 * (Never called with an empty list, so an API hiccup can't wipe a chat.)
 */
export async function archive(key: string | undefined, chatId: string, msgs: M[], win?: { lo: number; hi: number }) {
  if (!archiveEnabled || !key || !msgs.length) return;
  await upsert(key, msgs.map((m) => ({ chat: chatId, m })));
  if (win) {
    await db()`
      update messages set deleted_at = now()
      where account_key = ${key} and chat_id = ${chatId} and deleted_at is null
        and msg_id between ${win.lo} and ${win.hi}
        and not (msg_id = any(${msgs.map((m) => m.id)}::bigint[]))`;
  }
}

export async function deletedInWindow(key: string | undefined, chatId: string, lo: number, hi: number): Promise<ArchivedMsg[]> {
  if (!archiveEnabled || !key) return [];
  await ensureSchema();
  const r = await db()`
    select msg_id, date, out, sender_id, sender_name, text, media, web, reply_to, edited, history, deleted_at
    from messages where account_key = ${key} and chat_id = ${chatId} and deleted_at is not null
      and msg_id between ${lo} and ${hi} order by msg_id`;
  return r.map(rowToMsg);
}

export async function editedHistory(key: string | undefined, chatId: string, ids: number[]): Promise<Record<number, { text: string; at: string }[]>> {
  if (!archiveEnabled || !key || !ids.length) return {};
  await ensureSchema();
  const r = await db()`
    select msg_id, history from messages where account_key = ${key} and chat_id = ${chatId}
      and msg_id = any(${ids}::bigint[]) and jsonb_array_length(history) > 0`;
  return Object.fromEntries(r.map((x: any) => [Number(x.msg_id), x.history]));
}

export async function deletedCount(key: string | undefined, chatId: string): Promise<number> {
  if (!archiveEnabled || !key) return 0;
  await ensureSchema();
  const [r] = await db()`select count(*)::int as n from messages where account_key = ${key} and chat_id = ${chatId} and deleted_at is not null`;
  return r.n;
}

function rowToMsg(r: any): ArchivedMsg {
  return {
    id: Number(r.msg_id), date: new Date(r.date).toISOString(), out: r.out, text: r.text,
    sender: r.sender_name ? { id: r.sender_id || "0", name: r.sender_name } : null,
    media: r.media, web: r.web, reply_to: r.reply_to ? Number(r.reply_to) : null, edited: r.edited,
    history: r.history, deleted: !!r.deleted_at, deleted_at: r.deleted_at ? new Date(r.deleted_at).toISOString() : undefined,
  };
}

export async function getThumb(key: string | undefined, chatId: string, msgId: number): Promise<Buffer | null> {
  if (!archiveEnabled || !key) return null;
  await ensureSchema();
  const [r] = await db()`select data from thumbs where account_key = ${key} and chat_id = ${chatId} and msg_id = ${msgId}`;
  return r ? Buffer.from(r.data) : null;
}
export async function putThumb(key: string | undefined, chatId: string, msgId: number, data: Buffer) {
  if (!archiveEnabled || !key) return;
  await ensureSchema();
  await db()`insert into thumbs (account_key, chat_id, msg_id, data) values (${key}, ${chatId}, ${msgId}, ${data})
             on conflict do nothing`;
}

export type SyncState = { full: boolean; cursor: number | null; last_id: number | null; checked_at: string | null };

export async function getSyncState(key: string | undefined): Promise<Record<string, SyncState>> {
  if (!archiveEnabled || !key) return {};
  await ensureSchema();
  const r = await db()`select chat_id, full_at, cursor, last_id, checked_at from chat_sync where account_key = ${key}`;
  return Object.fromEntries(r.map((x: any) => [x.chat_id, {
    full: !!x.full_at, cursor: x.cursor ? Number(x.cursor) : null, last_id: x.last_id ? Number(x.last_id) : null,
    checked_at: x.checked_at ? new Date(x.checked_at).toISOString() : null,
  }]));
}

/** Records sync progress for a chat. cursor=null clears a resume point; undefined keeps it. */
export async function markSynced(key: string, chat: string, p: { full?: boolean; cursor?: number | null; lastId?: number }) {
  if (!archiveEnabled) return;
  await ensureSchema();
  const sql = db();
  await sql`
    insert into chat_sync (account_key, chat_id, full_at, cursor, last_id, checked_at)
    values (${key}, ${chat}, ${p.full ? sql`now()` : null}, ${p.cursor ?? null}, ${p.lastId ?? null}, now())
    on conflict (account_key, chat_id) do update set
      full_at = case when ${!!p.full} then now() else chat_sync.full_at end,
      cursor = case when ${p.cursor !== undefined} then ${p.cursor ?? null} else chat_sync.cursor end,
      last_id = coalesce(${p.lastId ?? null}, chat_sync.last_id),
      checked_at = now()`;
}

/* ---------------------------------------------------------------- pins (app-only, never sent to Telegram) -- */
export type PinnedMsg = ArchivedMsg & { chat_id: string; pinned_at: string };

export async function hasMessage(key: string, chat: string, msgId: number): Promise<boolean> {
  await ensureSchema();
  const [r] = await db()`select 1 as ok from messages where account_key = ${key} and chat_id = ${chat} and msg_id = ${msgId}`;
  return !!r;
}
export async function addPin(key: string, chat: string, msgId: number) {
  await ensureSchema();
  await db()`insert into pins (account_key, chat_id, msg_id) values (${key}, ${chat}, ${msgId}) on conflict do nothing`;
}
export async function removePin(key: string, chat: string, msgId: number) {
  await ensureSchema();
  await db()`delete from pins where account_key = ${key} and chat_id = ${chat} and msg_id = ${msgId}`;
}
export async function pinnedIds(key: string | undefined, chat: string): Promise<number[]> {
  if (!archiveEnabled || !key) return [];
  await ensureSchema();
  const r = await db()`select msg_id from pins where account_key = ${key} and chat_id = ${chat}`;
  return r.map((x: any) => Number(x.msg_id));
}
/** Pinned messages (newest pin first) with the archived copy of each message, one chat or all chats. */
export async function listPins(key: string | undefined, chat?: string): Promise<PinnedMsg[]> {
  if (!archiveEnabled || !key) return [];
  await ensureSchema();
  const sql = db();
  const r = await sql`
    select p.chat_id, p.pinned_at, m.msg_id, m.date, m.out, m.sender_id, m.sender_name, m.text, m.media, m.web,
           m.reply_to, m.edited, m.history, m.deleted_at
    from pins p join messages m on m.account_key = p.account_key and m.chat_id = p.chat_id and m.msg_id = p.msg_id
    where p.account_key = ${key} ${chat ? sql`and p.chat_id = ${chat}` : sql``}
    order by p.pinned_at desc limit 500`;
  return r.map((x: any) => ({ ...rowToMsg(x), chat_id: x.chat_id, pinned_at: new Date(x.pinned_at).toISOString() }));
}

/* ------------------------------------------- pinned conversations (app-only; Telegram's own pins are untouched) -- */
export async function getChatPins(key: string | undefined): Promise<Set<string>> {
  if (!archiveEnabled || !key) return new Set();
  await ensureSchema();
  const r = await db()`select chat_id from chat_pins where account_key = ${key}`;
  return new Set(r.map((x: any) => x.chat_id));
}
export async function setChatPin(key: string, chat: string, on: boolean) {
  await ensureSchema();
  const sql = db();
  if (on) await sql`insert into chat_pins (account_key, chat_id) values (${key}, ${chat}) on conflict do nothing`;
  else await sql`delete from chat_pins where account_key = ${key} and chat_id = ${chat}`;
}
