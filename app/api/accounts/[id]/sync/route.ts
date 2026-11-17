import { route, HttpError } from "@/lib/api";
import { archiveEnabled } from "@/lib/db";
import { syncChat } from "@/lib/sync";
import { archiveKey, peerFrom, withClient } from "@/lib/tg";

export const maxDuration = 60;

/** Saves a chat into the archive in resumable chunks. mode "recent" = newest page; "full" = whole history (optional `limit`). */
export const POST = route(async (req, { id }) => {
  if (!archiveEnabled) throw new HttpError(400, "Archive is off: set DATABASE_URL");
  const b = await req.json();
  const peer = peerFrom(new URLSearchParams({ t: b.t, pid: b.pid, h: b.h }));
  return withClient(id, async (c, a) => {
    const key = await archiveKey(c, a);
    if (!key) throw new HttpError(500, "Could not identify the account");
    return syncChat(c, key, String(b.c), peer, {
      mode: b.mode === "recent" ? "recent" : "full",
      before: Number(b.before) || 0,
      limit: b.limit ? Number(b.limit) : undefined,
    });
  });
});
