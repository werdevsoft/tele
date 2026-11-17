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
