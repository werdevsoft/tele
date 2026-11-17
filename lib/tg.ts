import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { LogLevel } from "telegram/extensions/Logger";
import { Account, getAccount, updateAccount } from "./store";
import { HttpError } from "./api";

export function makeClient(a: Pick<Account, "apiId" | "apiHash">, session = "") {
  const c = new TelegramClient(new StringSession(session), a.apiId, a.apiHash, {
    connectionRetries: 2, useWSS: false,
  });
  c.setLogLevel(LogLevel.NONE);
  return c;
}

/** Connects with the account's saved session, runs fn, always disconnects (serverless-friendly). */
export async function withClient<T>(accId: string, fn: (c: TelegramClient, a: Account) => Promise<T>, needAuth = true): Promise<T> {
  const a = await getAccount(accId);
  if (!a) throw new HttpError(404, "Account not found");
  if (needAuth && !a.session) throw new HttpError(401, "Not signed in");
  const c = makeClient(a, a.session);
  await c.connect();
  try { return await fn(c, a); }
  finally { try { await c.disconnect(); await c.destroy(); } catch {} }
}

/* Peers are passed by the browser (type + id + access hash) because StringSession has no entity cache. */
export function peerFrom(q: URLSearchParams): Api.TypeInputPeer {
  const t = q.get("t"), id = q.get("pid") || "0", hash = q.get("h") || "0";
  const big = (s: string) => BigInt(s) as any;
  if (t === "u") return new Api.InputPeerUser({ userId: big(id), accessHash: big(hash) });
  if (t === "ch") return new Api.InputPeerChannel({ channelId: big(id), accessHash: big(hash) });
  if (t === "c") return new Api.InputPeerChat({ chatId: big(id) });
  throw new HttpError(400, "Bad peer");
}

export function displayName(e: any): string {
  if (!e) return "";
  if (e.title) return e.title;
  return [e.firstName, e.lastName].filter(Boolean).join(" ") || e.username || "Deleted account";
}

export function serializeMessage(m: any) {
  const media = mediaKind(m.media);
  const s = m.sender;
  let web = null;
  if (m.media?.className === "MessageMediaWebPage" && m.media.webpage?.className === "WebPage") {
    const w = m.media.webpage;
    web = { url: w.url, title: w.title, site: w.siteName, description: w.description };
  }
  return {
    id: m.id, date: new Date(m.date * 1000).toISOString(), out: !!m.out, text: m.message || "",
    sender: s ? { id: String(s.id), name: displayName(s) } : null,
    media, web, reply_to: m.replyTo?.replyToMsgId ?? null, edited: !!m.editDate,
  };
}

function mediaKind(md: any): { kind: string; name?: string; duration?: number; size?: number } | null {
  if (!md) return null;
  switch (md.className) {
    case "MessageMediaPhoto": return { kind: "photo" };
    case "MessageMediaDocument": {
      const d = md.document; if (!d || d.className !== "Document") return { kind: "other" };
      const at: any[] = d.attributes || [];
      const find = (n: string) => at.find((x) => x.className === n);
      const fname = find("DocumentAttributeFilename")?.fileName;
      if (find("DocumentAttributeSticker")) return { kind: "sticker", name: find("DocumentAttributeSticker").alt };
      const v = find("DocumentAttributeVideo");
      if (v) return { kind: v.roundMessage ? "video_note" : "video", duration: Math.round(v.duration) };
      const au = find("DocumentAttributeAudio");
      if (au) return au.voice ? { kind: "voice", duration: au.duration } : { kind: "audio", name: fname || au.title, duration: au.duration };
      return { kind: "file", name: fname, size: Number(d.size) };
    }
    case "MessageMediaWebPage": return null;
    case "MessageMediaPoll": return { kind: "poll" };
    case "MessageMediaGeo": case "MessageMediaVenue": case "MessageMediaGeoLive": return { kind: "location" };
    case "MessageMediaContact": return { kind: "contact" };
    default: return { kind: "other" };
  }
}

export function previewText(m: any): string {
  if (!m) return "";
  if (m.message) return String(m.message).replace(/\n/g, " ").slice(0, 120);
  const k = mediaKind(m.media)?.kind;
  const L: Record<string, string> = { photo: "Photo", video: "Video", voice: "Voice message", sticker: "Sticker", audio: "Audio", file: "File", video_note: "Video message", poll: "Poll", location: "Location", contact: "Contact" };
  return k ? L[k] || "Message" : "";
}

/** Telegram user id used as the archive key; fetched once for accounts signed in before the archive existed. */
export async function archiveKey(c: TelegramClient, a: Account): Promise<string | undefined> {
  if (a.me?.id) return a.me.id;
  try {
    const me: any = await c.getMe();
    const id = String(me.id);
    await updateAccount(a.id, (x) => { x.me = { ...(x.me || { name: displayName(me) }), id }; });
    return id;
  } catch { return undefined; }
}

export const MAX_PAGE = 100;
