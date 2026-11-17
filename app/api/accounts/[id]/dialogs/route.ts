import { route } from "@/lib/api";
import { archiveMany, getChatPins, getSyncState } from "@/lib/archive";
import { archiveEnabled } from "@/lib/db";
import { archiveKey, previewText, serializeMessage, withClient } from "@/lib/tg";

export const maxDuration = 30;

export const GET = route(async (req, { id }) => {
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit")) || 100);
  return withClient(id, async (c, a) => {
    // Telegram keeps "Archived chats" in a separate folder (1) that getDialogs skips unless asked
    const main: any[] = await c.getDialogs({ limit });
    let folder: any[] = [];
    try { folder = await c.getDialogs({ limit: 100, folder: 1 }); } catch (e) { console.error("archived folder failed:", e); }
    const flags = new Map<any, boolean>();
    for (const d of folder) flags.set(d, true);
    const ds: any[] = [...main, ...folder];
    let sync: Awaited<ReturnType<typeof getSyncState>> | null = null;
    let pinned = new Set<string>();
    if (archiveEnabled) {
      try {
        const key = await archiveKey(c, a);
        sync = await getSyncState(key);
        pinned = await getChatPins(key);
        await archiveMany(key, ds.filter((d) => d.message?.className === "Message").map((d) => ({ chat: String(d.id), m: serializeMessage(d.message) })));
      } catch (e) { console.error("archive failed:", e); }
    }
    return ds.map((d: any) => {
      const e = d.entity;
      const cls = e?.className;
      const t = cls === "User" ? "u" : cls === "Channel" ? "ch" : "c";
      const type = cls === "User" ? (e.bot ? "bot" : "user") : cls === "Channel" ? (e.broadcast ? "channel" : "group") : "group";
      const ph = e?.photo && (e.photo.className === "UserProfilePhoto" || e.photo.className === "ChatPhoto") ? e.photo : null;
      return {
        id: String(d.id), name: d.name || "Deleted account", type, archived: !!flags.get(d), app_pinned: pinned.has(String(d.id)),
        peer: { t, pid: String(e?.id), h: e?.accessHash ? String(e.accessHash) : "0" },
        photo: ph ? { id: String(ph.photoId), dc: ph.dcId } : null,
        unread: d.unreadCount || 0, pinned: !!d.pinned,
        muted: !!(d.dialog?.notifySettings?.muteUntil),
        date: d.date ? new Date(d.date * 1000).toISOString() : null,
        preview: previewText(d.message), last_out: !!d.message?.out,
        last_id: d.message?.id ?? null,
        preview_media: !!d.message && !d.message.message && !!d.message.media,
        ...(sync ? { sync: sync[String(d.id)] ?? { full: false, cursor: null, last_id: null, checked_at: null } } : {}),
      };
    });
  });
});
