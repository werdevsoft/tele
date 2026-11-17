import { route } from "@/lib/api";
import { archiveMany } from "@/lib/archive";
import { archiveEnabled } from "@/lib/db";
import { archiveKey, previewText, serializeMessage, withClient } from "@/lib/tg";

export const maxDuration = 30;

export const GET = route(async (req, { id }) => {
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit")) || 100);
  return withClient(id, async (c, a) => {
    const ds = await c.getDialogs({ limit });
    if (archiveEnabled) {
      try {
        const key = await archiveKey(c, a);
        await archiveMany(key, (ds as any[]).filter((d) => d.message?.className === "Message").map((d) => ({ chat: String(d.id), m: serializeMessage(d.message) })));
      } catch (e) { console.error("archive failed:", e); }
    }
    return ds.map((d: any) => {
      const e = d.entity;
      const cls = e?.className;
      const t = cls === "User" ? "u" : cls === "Channel" ? "ch" : "c";
      const type = cls === "User" ? (e.bot ? "bot" : "user") : cls === "Channel" ? (e.broadcast ? "channel" : "group") : "group";
      const ph = e?.photo && (e.photo.className === "UserProfilePhoto" || e.photo.className === "ChatPhoto") ? e.photo : null;
      return {
        id: String(d.id), name: d.name || "Deleted account", type,
        peer: { t, pid: String(e?.id), h: e?.accessHash ? String(e.accessHash) : "0" },
        photo: ph ? { id: String(ph.photoId), dc: ph.dcId } : null,
        unread: d.unreadCount || 0, pinned: !!d.pinned,
        muted: !!(d.dialog?.notifySettings?.muteUntil),
        date: d.date ? new Date(d.date * 1000).toISOString() : null,
        preview: previewText(d.message), last_out: !!d.message?.out,
      };
    });
  });
});
