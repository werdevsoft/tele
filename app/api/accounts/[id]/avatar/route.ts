import { Api } from "telegram";
import { route } from "@/lib/api";
import { peerFrom, withClient } from "@/lib/tg";

export const GET = route(async (req, { id }) => {
  const q = req.nextUrl.searchParams;
  const photoId = q.get("p"), dc = Number(q.get("dc"));
  if (!photoId || !dc) return new Response(null, { status: 204 });
  const peer = peerFrom(q);
  return withClient(id, async (c) => {
    const loc = new Api.InputPeerPhotoFileLocation({ peer, photoId: BigInt(photoId) as any, big: false });
    const buf = (await c.downloadFile(loc, { dcId: dc })) as Buffer;
    if (!buf || !buf.length) return new Response(null, { status: 204 });
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=604800, immutable" } });
  });
});
