import { route, HttpError } from "@/lib/api";
import { getThumb, putThumb } from "@/lib/archive";
import { archiveEnabled } from "@/lib/db";
import { getAccount } from "@/lib/store";
import { peerFrom, withClient } from "@/lib/tg";

export const maxDuration = 30;
const H = { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=604800, immutable" };

// Only small previews are fetched (never the original file). Previews are cached in Postgres so they
// still show after the message is deleted on Telegram.
export const GET = route(async (req, { id }) => {
  const q = req.nextUrl.searchParams;
  const msgId = Number(q.get("m")), chat = q.get("c") || "";
  if (!msgId) throw new HttpError(400, "Missing message id");
  const acc = await getAccount(id);
  const key = acc?.me?.id;
  if (archiveEnabled && key && chat) {
    try { const hit = await getThumb(key, chat, msgId); if (hit) return new Response(new Uint8Array(hit), { headers: H }); } catch {}
  }
  const peer = peerFrom(q);
  return withClient(id, async (c) => {
    const [m]: any[] = await c.getMessages(peer, { ids: [msgId] });
    if (!m?.media) throw new HttpError(404, "No media");
    let buf: any = null;
    for (const thumb of [2, 1, 0]) {
      try { buf = await c.downloadMedia(m, { thumb }); if (buf?.length) break; } catch {}
    }
    if (!buf?.length) throw new HttpError(404, "No preview");
    if (archiveEnabled && key && chat) { try { await putThumb(key, chat, msgId, Buffer.from(buf)); } catch {} }
    return new Response(new Uint8Array(buf), { headers: H });
  });
});
