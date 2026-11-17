import { route, HttpError } from "@/lib/api";
import { archive, MAX_ID } from "@/lib/archive";
import { archiveEnabled } from "@/lib/db";
import { loadAccounts } from "@/lib/store";
import { archiveKey, serializeMessage, withClient } from "@/lib/tg";
import { Api } from "telegram";

export const maxDuration = 60;

/**
 * Scheduled sweep (Vercel Cron): for every signed-in account, re-reads the newest messages of the most
 * recently active chats, saves them, and marks anything that disappeared since last time as deleted.
 */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized");
  if (!archiveEnabled) return { skipped: "DATABASE_URL not set" };
  const started = Date.now();
  const report: Record<string, number | string> = {};
  for (const a of await loadAccounts()) {
    if (!a.session) continue;
    try {
      let chats = 0;
      await withClient(a.id, async (c, acc) => {
        const key = await archiveKey(c, acc);
        const ds = await c.getDialogs({ limit: 40 });
        for (const d of ds as any[]) {
          if (Date.now() - started > 45_000) break;
          const e = d.entity;
          const peer = e.className === "User" ? new Api.InputPeerUser({ userId: e.id, accessHash: e.accessHash })
            : e.className === "Channel" ? new Api.InputPeerChannel({ channelId: e.id, accessHash: e.accessHash })
            : new Api.InputPeerChat({ chatId: e.id });
          const raw: any[] = [...(await c.getMessages(peer, { limit: 100 }))];
          const items = raw.filter((m) => m.className === "Message").map(serializeMessage).reverse();
          const lo = raw.length === 100 ? Math.min(...raw.map((m) => m.id)) : 0;
          await archive(key, String(d.id), items, items.length ? { lo, hi: MAX_ID } : undefined);
          chats++;
        }
      });
      report[a.label] = chats;
    } catch (e: any) { report[a.label] = "error: " + (e?.errorMessage || e?.message); }
  }
  return { ok: true, chats_synced: report };
}, { public: true });
