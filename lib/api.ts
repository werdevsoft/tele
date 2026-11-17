import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { checkToken } from "./crypto";

export const COOKIE = "tgr_auth";

export class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, p: Record<string, string>) => Promise<Response | object>;

/** Wraps a route: requires the app login cookie and turns errors into JSON. */
export function route(h: Handler, opts: { public?: boolean } = {}) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      if (!opts.public) {
        if (!process.env.APP_PASSWORD && process.env.NODE_ENV === "production")
          throw new HttpError(500, "APP_PASSWORD is not set on the server");
        const t = (await cookies()).get(COOKIE)?.value;
        if (!checkToken(t)) throw new HttpError(401, "Locked");
      }
      const out = await h(req, await ctx.params);
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

