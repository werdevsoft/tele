import { route, HttpError } from "@/lib/api";
import { deleteAccount, getAccount, putAccount } from "@/lib/store";

export const PATCH = route(async (req, { id }) => {
  const b = await req.json();
  const a = await getAccount(id);
  if (!a) throw new HttpError(404, "Account not found");
  if (b.label) a.label = String(b.label).trim();
  const newId = b.api_id ? Number(b.api_id) : a.apiId;
  const newHash = b.api_hash ? String(b.api_hash).trim() : a.apiHash;
  if (newId !== a.apiId || newHash !== a.apiHash) {     // new keys invalidate the old session
    a.apiId = newId; a.apiHash = newHash; a.session = ""; a.pending = undefined; a.me = undefined;
  }
  await putAccount(a);
  return { id: a.id, label: a.label, api_id: a.apiId, me: a.me, authorized: !!a.session };
});

export const DELETE = route(async (_req, { id }) => {
  await deleteAccount(id);
  return { ok: true };
});
