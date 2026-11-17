export type Peer = { t: string; pid: string; h: string };
export type Account = { id: string; label: string; api_id: number; authorized: boolean; me?: { name: string; username?: string; phone?: string } };
export type Dialog = {
  id: string; name: string; type: "user" | "bot" | "group" | "channel"; peer: Peer;
  photo: { id: string; dc: number } | null; unread: number; pinned: boolean; muted: boolean;
  date: string | null; preview: string; last_out: boolean;
};
export type Media = { kind: string; name?: string; duration?: number; size?: number } | null;
export type Msg = {
  id: number; date: string; out: boolean; text: string; sender: { id: string; name: string } | null;
  media: Media; web: { url: string; title?: string; site?: string; description?: string } | null;
  reply_to: number | null; edited: boolean;
  deleted?: boolean; deleted_at?: string; history?: { text: string; at: string }[];
};

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    method, headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    let d = r.statusText;
    try { d = (await r.json()).detail || d; } catch {}
    throw new ApiError(String(d), r.status);
  }
  return r.status === 204 ? (null as T) : r.json();
}

export const peerQS = (p: Peer) => `t=${p.t}&pid=${p.pid}&h=${p.h}`;

export const hue = (s: string) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
export const initials = (n: string) => (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase();
export const avatarBg = (k: string) => `hsl(${hue(k)} 28% 44%)`;

export function fmtTime(iso: string, clockOnly = false) {
  const d = new Date(iso), n = new Date();
  if (clockOnly || d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if ((n.getTime() - d.getTime()) / 864e5 < 6) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === n.getFullYear() ? undefined : "2-digit" });
}
export function dayLabel(iso: string) {
  const d = new Date(iso), n = new Date(), y = new Date(n);
  y.setDate(n.getDate() - 1);
  if (d.toDateString() === n.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() === n.getFullYear() ? undefined : "numeric" });
}
export const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
export const fmtSize = (b: number) => (b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");
