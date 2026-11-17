import { archiveEnabled, db, ensureSchema } from "./db";
import { decrypt, encrypt } from "./crypto";

export type Account = {
  id: string;
  ownerId?: string;       // the app user this Telegram account belongs to (stored in its own column)
  label: string;
  apiId: number;
  apiHash: string;
  session: string;        // GramJS StringSession ("" until signed in)
  pending?: { phone: string; hash: string; session: string };
  me?: { id?: string; name: string; username?: string; phone?: string };
};

/* Telegram accounts live in Postgres (table `accounts`): one row each, payload AES-256-GCM encrypted. */
function conn() {
  if (!archiveEnabled) throw new Error("DATABASE_URL is not set. Add a Postgres database (see README).");
  return ensureSchema().then(() => db());
}
function parse(r: any): Account {
  try { return { ...JSON.parse(decrypt(r.data)), ownerId: r.owner_id ?? undefined }; }
  catch { throw new Error("Could not decrypt stored accounts. Did APP_SECRET change?"); }
}

/** Accounts of one user, or every account when ownerId is omitted (system jobs only). */
export async function loadAccounts(ownerId?: string): Promise<Account[]> {
  const sql = await conn();
  const rows = ownerId
    ? await sql`select data, owner_id from accounts where owner_id = ${ownerId} order by created_at, id`
    : await sql`select data, owner_id from accounts order by created_at, id`;
  // one unreadable row (e.g. written under another APP_SECRET) must not hide everyone else's accounts
  return rows.flatMap((r) => { try { return [parse(r)]; } catch (e) { console.error("skipping unreadable account row", (r as any).owner_id); return []; } });
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const sql = await conn();
  const [r] = await sql`select data, owner_id from accounts where id = ${id}`;
  return r ? parse(r) : undefined;
}

export async function accountOwner(id: string): Promise<string | null | undefined> {
  const sql = await conn();
  const [r] = await sql`select owner_id from accounts where id = ${id}`;
  return r ? r.owner_id : undefined;
}

export async function putAccount(a: Account) {
  if (!a.ownerId) throw new Error("Account has no owner");
  const { ownerId, ...rest } = a;
  const sql = await conn();
  await sql`insert into accounts (id, data, owner_id) values (${a.id}, ${encrypt(JSON.stringify(rest))}, ${ownerId})
            on conflict (id) do update set data = excluded.data`;
}

export async function deleteAccount(id: string) {
  const sql = await conn();
  await sql`delete from accounts where id = ${id}`;
}

export async function updateAccount(id: string, fn: (a: Account) => void): Promise<Account | undefined> {
  const a = await getAccount(id);
  if (!a) return undefined;
  fn(a);
  await putAccount(a);
  return a;
}

export const pub = (a: Account) => ({ id: a.id, label: a.label, api_id: a.apiId, me: a.me, authorized: !!a.session });
