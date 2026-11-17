import { route, HttpError, friendly } from "@/lib/api";
import { getAccount, updateAccount } from "@/lib/store";
import { makeClient } from "@/lib/tg";

export const POST = route(async (req, { id }) => {
  const { phone } = await req.json();
  const a = await getAccount(id);
  if (!a) throw new HttpError(404, "Account not found");
  const c = makeClient(a, "");
  await c.connect();
  try {
    const r = await c.sendCode({ apiId: a.apiId, apiHash: a.apiHash }, String(phone).trim());
    const session = (c.session as any).save() as string;
    await updateAccount(id, (x) => { x.pending = { phone: String(phone).trim(), hash: r.phoneCodeHash, session }; });
    return { ok: true, via_app: r.isCodeViaApp };
  } catch (e) { friendly(e); }
  finally { try { await c.disconnect(); await c.destroy(); } catch {} }
});
