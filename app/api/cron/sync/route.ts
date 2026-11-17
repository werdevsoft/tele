import { Api } from "telegram";
import { route, HttpError } from "@/lib/api";
import { getSyncState } from "@/lib/archive";
import { archiveEnabled } from "@/lib/db";
import { loadAccounts } from "@/lib/store";
import { AUTO_LIMIT, syncChat } from "@/lib/sync";
import { archiveKey, withClient } from "@/lib/tg";

export const maxDuration = 60;

const peerOf = (e: any) =>
  e.className === "User" ? new Api.InputPeerUser({ userId: e.id, accessHash: e.accessHash })
  : e.className === "Channel" ? new Api.InputPeerChannel({ channelId: e.id, accessHash: e.accessHash })
  : new Api.InputPeerChat({ chatId: e.id });

/**
 * Scheduled sweep (Vercel Cron), for every signed-in account:
 *  1. re-reads the newest messages of the 40 most recently active chats (new messages, recent deletions);
 *  2. with the time left, keeps backfilling chats that are not fully saved yet (newest AUTO_LIMIT messages each),
 *     resuming where the previous run stopped.
 */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized");
  if (!archiveEnabled) return { skipped: "DATABASE_URL not set" };
  const started = Date.now(), left = () => 50_000 - (Date.now() - started);
  const report: Record<string, string> = {};
  for (const a of await loadAccounts()) {
    if (!a.session || left() < 5000) continue;
    try {
      let recent = 0, backfilled = 0;
      await withClient(a.id, async (c, acc) => {
        const key = await archiveKey(c, acc);
        if (!key) return;
        const ds = (await c.getDialogs({ limit: 100 })) as any[];
        try { ds.push(...((await c.getDialogs({ limit: 50, folder: 1 })) as any[])); } catch {}   // Telegram's Archived chats folder
        const state = await getSyncState(key);
        for (const d of ds.slice(0, 40)) {
          if (left() < 5000) break;
          await syncChat(c, key, String(d.id), peerOf(d.entity), { mode: "recent" }); recent++;
        }
        for (const d of ds) {
          if (left() < 8000) break;
          const st = state[String(d.id)];
          if (st?.full) continue;
          const r = await syncChat(c, key, String(d.id), peerOf(d.entity), { mode: "full", before: st?.cursor || 0, limit: AUTO_LIMIT, budgetMs: left() - 4000 });
          if (r.done) backfilled++;
        }
      });
      report[a.label] = `${recent} refreshed, ${backfilled} backfilled`;
    } catch (e: any) { report[a.label] = "error: " + (e?.errorMessage || e?.message); }
  }
  return { ok: true, report };
}, { public: true });
