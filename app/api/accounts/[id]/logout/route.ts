import { Api } from "telegram";
import { route } from "@/lib/api";
import { updateAccount } from "@/lib/store";
import { withClient } from "@/lib/tg";

export const POST = route(async (_req, { id }) => {
  try { await withClient(id, (c) => c.invoke(new Api.auth.LogOut())); } catch {}
  await updateAccount(id, (x) => { x.session = ""; x.pending = undefined; x.me = undefined; });
  return { ok: true };
});
