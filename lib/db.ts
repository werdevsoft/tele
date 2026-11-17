import postgres from "postgres";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const archiveEnabled = !!url;

let _sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

export function db(): postgres.Sql {
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!_sql) {
    const local = /@(localhost|127\.0\.0\.1)/.test(url);
    _sql = postgres(url, { max: 1, idle_timeout: 20, prepare: false, ssl: local ? false : "require" });
  }
  return _sql;
}

/** Creates tables on first use (idempotent). */
export function ensureSchema(): Promise<void> {
  if (!ready) {
    const sql = db();
    ready = (async () => {
      await sql`create table if not exists users (
        id text primary key,
        username text not null unique,
        pw_hash text not null,
        is_admin boolean not null default false,
        fail_count int not null default 0,
        locked_until timestamptz,
        created_at timestamptz not null default now()
      )`;
      await sql`create table if not exists accounts (
        id text primary key,
        data text not null,                  -- AES-256-GCM encrypted JSON (api_hash, session...)
        created_at timestamptz not null default now()
      )`;
      await sql`alter table accounts add column if not exists owner_id text`;
      await sql`create index if not exists accounts_owner_idx on accounts (owner_id)`;
      await sql`create table if not exists messages (
        account_key text not null,           -- Telegram user id of the account
        chat_id     text not null,
        msg_id      bigint not null,
        date        timestamptz not null,
        out         boolean not null default false,
        sender_id   text,
        sender_name text,
        text        text not null default '',
        media       jsonb,
        web         jsonb,
        reply_to    bigint,
        edited      boolean not null default false,
        history     jsonb not null default '[]'::jsonb,   -- previous texts if the message was edited
        first_seen  timestamptz not null default now(),
        last_seen   timestamptz not null default now(),
        deleted_at  timestamptz,
        primary key (account_key, chat_id, msg_id)
      )`;
      await sql`create index if not exists messages_deleted_idx on messages (account_key, chat_id, msg_id) where deleted_at is not null`;
      await sql`create table if not exists chat_sync (
        account_key text not null, chat_id text not null,
        full_at    timestamptz,          -- history backfill finished (or hit the auto-save cap)
        cursor     bigint,               -- resume point of an unfinished backfill (oldest id saved so far)
        last_id    bigint,               -- newest message id seen at the last sync
        checked_at timestamptz,
        primary key (account_key, chat_id)
      )`;
      await sql`create table if not exists pins (
        account_key text not null, chat_id text not null, msg_id bigint not null,
        pinned_at timestamptz not null default now(),
        primary key (account_key, chat_id, msg_id)
      )`;
      await sql`create table if not exists chat_pins (
        account_key text not null, chat_id text not null,
        pinned_at timestamptz not null default now(),
        primary key (account_key, chat_id)
      )`;
      await sql`create table if not exists thumbs (
        account_key text not null, chat_id text not null, msg_id bigint not null, data bytea not null,
        primary key (account_key, chat_id, msg_id)
      )`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
