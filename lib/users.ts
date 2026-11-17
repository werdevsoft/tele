import { randomBytes } from "crypto";
import { db, ensureSchema } from "./db";
import { hashPassword } from "./crypto";
import { loadAccounts } from "./store";

export type User = { id: string; username: string; pw_hash: string; is_admin: boolean; locked_until: Date | null };
export const publicUser = (u: User) => ({ id: u.id, username: u.username, is_admin: u.is_admin });

const sql = async () => { await ensureSchema(); return db(); };

export const normUsername = (s: string) => String(s ?? "").trim().toLowerCase();
export function validate(username: string, password?: string): string | null {
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return "Username: 3-32 characters, letters, numbers, . _ -";
  if (password !== undefined && password.length < 8) return "Password must be at least 8 characters (it protects Telegram sessions).";
  return null;
}

export async function countUsers(): Promise<number> {
  const q = await sql();
  const [r] = await q`select count(*)::int as n from users`;
  return r.n;
}
export async function findByUsername(username: string): Promise<User | undefined> {
  const q = await sql();
  const [r] = await q`select * from users where username = ${username}`;
  return r as any;
}
export async function getUser(id: string): Promise<User | undefined> {
  const q = await sql();
  const [r] = await q`select * from users where id = ${id}`;
  return r as any;
}
export async function listUsers() {
  const q = await sql();
  return q`
    select u.id, u.username, u.is_admin, u.created_at,
           (select count(*)::int from accounts a where a.owner_id = u.id) as accounts
    from users u order by u.created_at`;
}

/** Creates a user. With firstOnly, succeeds only when no user exists yet (atomic first-run setup). */
export async function createUser(username: string, password: string, isAdmin: boolean, firstOnly = false): Promise<User | undefined> {
  const s = await sql(), id = randomBytes(6).toString("hex"), pw = await hashPassword(password);
  const rows = firstOnly
    ? await s`insert into users (id, username, pw_hash, is_admin) select ${id}, ${username}, ${pw}, ${isAdmin}
              where not exists (select 1 from users) returning *`
    : await s`insert into users (id, username, pw_hash, is_admin) values (${id}, ${username}, ${pw}, ${isAdmin}) returning *`;
  return rows[0] as any;
}

/** Accounts saved before multi-user existed have no owner: hand them to the first admin. */
export async function adoptOrphans(userId: string) {
  const q = await sql();
  await q`update accounts set owner_id = ${userId} where owner_id is null`;
}

export async function setPassword(id: string, password: string) {
  const q = await sql();
  await q`update users set pw_hash = ${await hashPassword(password)}, fail_count = 0, locked_until = null where id = ${id}`;
}
export async function recordFailure(id: string) {
  const q = await sql();
  await q`update users set
    fail_count = case when fail_count + 1 >= 5 then 0 else fail_count + 1 end,
    locked_until = case when fail_count + 1 >= 5 then now() + interval '15 minutes' else locked_until end
    where id = ${id}`;
}
export async function clearFailures(id: string) {
  const q = await sql();
  await q`update users set fail_count = 0, locked_until = null where id = ${id}`;
}

/** Removes a user, their Telegram accounts, and the archived messages of those accounts. */
export async function deleteUser(id: string) {
  const s = await sql();
  const mine = await loadAccounts(id);
  const others = new Set((await loadAccounts()).filter((a) => a.ownerId !== id).map((a) => a.me?.id).filter(Boolean));
  const keys = [...new Set(mine.map((a) => a.me?.id).filter((k): k is string => !!k && !others.has(k)))];
  if (keys.length) {
    await s`delete from messages where account_key = any(${keys}::text[])`;
    await s`delete from thumbs where account_key = any(${keys}::text[])`;
  }
  await s`delete from accounts where owner_id = ${id}`;
  await s`delete from users where id = ${id}`;
}
