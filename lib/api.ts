import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseToken, pwTag, makeToken } from "./crypto";
import { accountOwner } from "./store";
import { getUser, User } from "./users";

export const COOKIE = "tgr_auth";

export class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export async function currentUser(): Promise<User | null> {
  const t = parseToken((await cookies()).get(COOKIE)?.value);
  if (!t) return null;
  const u = await getUser(t.uid);
  return u && pwTag(u.pw_hash) === t.tag ? u : null;
}

export function withSession(res: NextResponse, u: User) {
  res.cookies.set(COOKIE, makeToken(u.id, pwTag(u.pw_hash), 30), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400,
  });
  return res;
}

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, p: Record<string, string>, user: User) => Promise<Response | object>;

/**
 * Wraps a route: requires a signed-in user and turns errors into JSON.
 * Any route with an `[id]` segment is an account route: the account must belong to the caller (404 otherwise),
 * so a forgotten check in a handler can't expose someone else's Telegram.
 */
export function route(h: Handler, opts: { public?: boolean; admin?: boolean } = {}) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      const p = (await ctx.params) ?? {};
      let user: User | null = null;
      if (!opts.public) {
        user = await currentUser();
        if (!user) throw new HttpError(401, "Locked");
        if (opts.admin && !user.is_admin) throw new HttpError(403, "Admins only");
        if (p.id && (await accountOwner(p.id)) !== user.id) throw new HttpError(404, "Account not found");
      }
      const out = await h(req, p, user as User);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e: any) {
      if (e instanceof HttpError) return NextResponse.json({ detail: e.message }, { status: e.status });
      const msg = String(e?.errorMessage || e?.message || e);
      const status = /AUTH_KEY|SESSION_REVOKED|USER_DEACTIVATED/.test(msg) ? 401 : 500;
      return NextResponse.json({ detail: msg, code: status === 401 ? "tg_unauth" : undefined }, { status });
    }
  };
}

export function friendly(e: any): never {
  const m = String(e?.errorMessage || e?.message || e);
  const map: Record<string, string> = {
    API_ID_INVALID: "Telegram rejected these api_id / api_hash. Check them in account settings.",
    PHONE_NUMBER_INVALID: "That phone number looks invalid. Include the country code.",
    PHONE_CODE_INVALID: "Wrong code.", PHONE_CODE_EXPIRED: "Code expired. Go back and request a new one.",
    PASSWORD_HASH_INVALID: "Wrong 2FA password.", PHONE_NUMBER_BANNED: "This number is banned by Telegram.",
  };
  if (map[m]) throw new HttpError(400, map[m]);
  const flood = m.match(/FLOOD.*?(\d+)/);
  if (flood) throw new HttpError(429, `Too many attempts. Try again in ${flood[1]}s.`);
  throw e;
}

