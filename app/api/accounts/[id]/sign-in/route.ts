import { Api } from "telegram";
import { route, HttpError, friendly } from "@/lib/api";
import { getAccount, updateAccount } from "@/lib/store";
import { displayName, makeClient } from "@/lib/tg";

export const POST = route(async (req, { id }) => {
  const { code, password } = await req.json();
  const a = await getAccount(id);
  if (!a) throw new HttpError(404, "Account not found");
  if (!a.pending) throw new HttpError(400, "Request a code first");
  const p = a.pending;
  const c = makeClient(a, p.session);
  await c.connect();
  try {
    if (password) {
      await c.signInWithPassword({ apiId: a.apiId, apiHash: a.apiHash }, {
        password: async () => String(password),
        onError: async (e: Error) => { throw e; },
      });
    } else {
      try {
        await c.invoke(new Api.auth.SignIn({ phoneNumber: p.phone, phoneCodeHash: p.hash, phoneCode: String(code).trim() }));
      } catch (e: any) {
        if (e?.errorMessage === "SESSION_PASSWORD_NEEDED") {
          await updateAccount(id, (x) => { if (x.pending) x.pending.session = (c.session as any).save(); });
          return { needs_password: true };
        }
        throw e;
      }
    }
    const me: any = await c.getMe();
    const session = (c.session as any).save() as string;
    await updateAccount(id, (x) => {
      x.session = session; x.pending = undefined;
      x.me = { id: String(me.id), name: displayName(me), username: me.username, phone: me.phone };
    });
    return { ok: true };
  } catch (e) { friendly(e); }
  finally { try { await c.disconnect(); await c.destroy(); } catch {} }
});
