import { promises as fs } from "fs";
import path from "path";
import { db, archiveEnabled, ensureSchema } from "./db";
import { decrypt, encrypt } from "./crypto";

export type Account = {
  id: string;
  label: string;
  apiId: number;
  apiHash: string;
  session: string;        // GramJS StringSession ("" until signed in)
  pending?: { phone: string; hash: string; session: string };
  me?: { id?: string; name: string; username?: string; phone?: string };
};

/*
 * Accounts live in Postgres (table `accounts`, one encrypted row each).
 * Without DATABASE_URL (local dev only) they fall back to an encrypted file, .data/store.json.
 */
const FILE = path.join(process.cwd(), ".data", "store.json");

async function fileRead(): Promise<Account[]> {
  try { return JSON.parse(decrypt(await fs.readFile(FILE, "utf8"))); } catch (e: any) {
    if (e?.code === "ENOENT") return [];
    throw new Error("Could not decrypt stored accounts. Did APP_SECRET change?");
  }
}
async function fileWrite(items: Account[]) {
  if (process.env.VERCEL) throw new Error("No database configured: set DATABASE_URL.");
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, encrypt(JSON.stringify(items)), { mode: 0o600 });
}

export async function loadAccounts(): Promise<Account[]> {
  if (!archiveEnabled) return fileRead();
  await ensureSchema();
  const rows = await db()`select data from accounts order by created_at, id`;
  try { return rows.map((r: any) => JSON.parse(decrypt(r.data))); }
  catch { throw new Error("Could not decrypt stored accounts. Did APP_SECRET change?"); }
}

export async function putAccount(a: Account) {
  if (!archiveEnabled) {
    const items = await fileRead(), i = items.findIndex((x) => x.id === a.id);
    if (i >= 0) items[i] = a; else items.push(a);
    return fileWrite(items);
  }
  await ensureSchema();
  await db()`insert into accounts (id, data) values (${a.id}, ${encrypt(JSON.stringify(a))})
             on conflict (id) do update set data = excluded.data`;
}

export async function deleteAccount(id: string) {
  if (!archiveEnabled) return fileWrite((await fileRead()).filter((x) => x.id !== id));
  await ensureSchema();
  await db()`delete from accounts where id = ${id}`;
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return (await loadAccounts()).find((a) => a.id === id);
}

export async function updateAccount(id: string, fn: (a: Account) => void): Promise<Account | undefined> {
  const a = await getAccount(id);
  if (!a) return undefined;
  fn(a);
  await putAccount(a);
  return a;
}

export const pub = (a: Account) => ({ id: a.id, label: a.label, api_id: a.apiId, me: a.me, authorized: !!a.session });
