"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Ic from "./Icons";
import AccountDialog from "./AccountDialog";
import LoginCard from "./LoginCard";
import UsersDialog from "./UsersDialog";
import PasswordDialog from "./PasswordDialog";
import ConfirmDialog from "./ConfirmDialog";
import SettingsDialog from "./SettingsDialog";
import { Key, Rich, useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import type { Me } from "./Gate";
import { Account, Dialog, Msg, Pin, api, dedupeMsgs, ApiError, avatarBg, dayLabel, fmtDur, fmtSize, fmtTime, hue, initials, peerQS } from "@/lib/client";

const FILTERS = [["all", "filter.all"], ["unread", "filter.unread"], ["user", "filter.user"], ["group", "filter.group"], ["channel", "filter.channel"], ["archived", "filter.archived"]] as const;
const PREVIEW: Record<string, Key> = { Photo: "media.photo", Video: "media.video", "Video message": "media.video", "Voice message": "media.voice", Sticker: "media.sticker", Audio: "media.audio", File: "media.file", Poll: "media.poll", Location: "media.location", Contact: "media.contact", Message: "media.other" };

function Avatar({ accId, d, small }: { accId: string; d: { id: string; name: string; peer?: Dialog["peer"]; photo?: Dialog["photo"] }; small?: boolean }) {
  const [bad, setBad] = useState(false);
  const src = d.photo && d.peer ? `/api/accounts/${accId}/avatar?${peerQS(d.peer)}&p=${d.photo.id}&dc=${d.photo.dc}` : null;
  return (
    <div className={"avatar" + (small ? " sm" : "")} style={{ background: avatarBg(d.id) }}>
      {initials(d.name)}
      {src && !bad && <img loading="lazy" src={src} alt="" onError={() => setBad(true)} />}
    </div>
  );
}

function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g);
  return <>{parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a> : p))}</>;
}

function MediaView({ m, src }: { m: Msg; src: string }) {
  const [bad, setBad] = useState(false);
  const { t } = useI18n();
  const k = m.media; if (!k) return null;
  const Att = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => <div className="attach">{icon}<span>{children}</span></div>;
  if (["photo", "sticker", "video", "video_note"].includes(k.kind)) {
    const label = k.kind === "photo" ? t("media.photo") : k.kind === "sticker" ? k.name || t("media.sticker") : t("media.video");
    return (<>
      {!bad && <img className="thumb" style={k.kind === "sticker" ? { maxHeight: 160, background: "none" } : undefined} loading="lazy" src={src} alt={label} onError={() => setBad(true)} />}
      {(bad || k.kind.startsWith("video")) && <Att icon={k.kind.startsWith("video") ? <Ic.Play /> : <Ic.File />}>{label}{k.duration ? <> <small>{fmtDur(k.duration)}</small></> : null}</Att>}
    </>);
  }
  if (k.kind === "voice") return <Att icon={<Ic.Mic />}>{t("media.voice")}{k.duration ? <> <small>{fmtDur(k.duration)}</small></> : null}</Att>;
  if (k.kind === "location") return <Att icon={<Ic.Pin />}>{t("media.location")}</Att>;
  if (k.kind === "file" || k.kind === "audio") return <Att icon={<Ic.File />}>{k.name || (k.kind === "audio" ? t("media.audio") : t("media.file"))}{k.size ? <> <small>{fmtSize(k.size)}</small></> : null}</Att>;
  return <Att icon={<Ic.File />}>{k.kind === "poll" || k.kind === "contact" ? t(`media.${k.kind}` as Key) : t("media.other")}</Att>;
}

export default function Reader({ user, onLock }: { user: Me; onLock: () => void }) {
  const { t, tr, locale } = useI18n();
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accId, setAccId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [dialogs, setDialogs] = useState<Dialog[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [chat, setChat] = useState<Dialog | null>(null);
  const [view, setView] = useState<"list" | "chat">("list");
  const [dlg, setDlg] = useState<{ acc: Account | null } | null>(null);
  const [listErr, setListErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<null | "settings" | "users" | "password">(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [focus, setFocus] = useState<{ chat: string; id: number; n: number } | null>(null);   // jump target from the pinned list
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [menu]);
  const accRef = useRef<string | null>(null);
  accRef.current = accId;

  // ---- automatic archiving: after sign-in, every chat is copied to the archive in the background ----
  const [auto, setAuto] = useState<{ state: "off" | "running" | "paused" | "finished"; done: number; total: number; failed: number }>({ state: "off", done: 0, total: 0, failed: 0 });
  const autoFor = useRef<string | null>(null);
  const pausedRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const runAuto = useCallback(async (id: string, ds: Dialog[]) => {
    const AUTO_LIMIT = 3000;                 // newest messages kept per chat by automatic saving
    const current = () => alive.current && accRef.current === id;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const todo = ds.flatMap((d) => {
      const s = d.sync!;
      const stale = !s.checked_at || Date.now() - Date.parse(s.checked_at) > 6 * 3600e3;
      const mode = !s.full ? "full" : d.last_id !== s.last_id || stale ? "recent" : null;
      return mode ? [{ d, mode }] : [];
    });
    if (!todo.length) return;
    let done = 0, failed = 0;
    setAuto({ state: "running", done, total: todo.length, failed });
    const waitIfPaused = async () => { while (pausedRef.current && current()) await sleep(400); };
    for (const { d, mode } of todo) {
      await waitIfPaused(); if (!current()) return;
      try {
        let before = mode === "full" ? d.sync!.cursor || 0 : 0, total = 0;
        while (true) {
          const r = await api<{ saved: number; done: boolean; next_before: number | null }>(`/accounts/${id}/sync`, "POST",
            { ...d.peer, c: d.id, mode, before, limit: mode === "full" ? AUTO_LIMIT - total : undefined });
          total += r.saved;
          if (r.done) break;
          before = r.next_before!;
          await waitIfPaused(); if (!current()) return;
        }
      } catch { failed++; await sleep(1500); }       // skip this chat; the daily job and the next sign-in retry it
      done++; if (current()) setAuto({ state: pausedRef.current ? "paused" : "running", done, total: todo.length, failed });
      await sleep(120);
    }
    if (!current()) return;
    setAuto({ state: "off", done, total: todo.length, failed });
    toast(t("auto.finished"));
    loadDialogs(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acc = accounts.find((a) => a.id === accId) || null;

  const loadAccounts = useCallback(async () => { const a = await api<Account[]>("/accounts"); setAccounts(a); return a; }, []);

  const loadDialogs = useCallback(async (id: string, first = false) => {
    if (first) { setDialogs(null); setListErr(""); }
    try {
      const d = await api<Dialog[]>(`/accounts/${id}/dialogs?limit=150`);
      if (accRef.current === id) { setDialogs(d); setListErr(""); }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { await loadAccounts(); return; }
      if (accRef.current === id && first) setListErr(tr((e as Error).message));
    }
  }, [loadAccounts]);

  useEffect(() => {
    loadAccounts().then((a) => {
      const saved = localStorage.getItem("acc");
      setAccId(a.find((x) => x.id === saved)?.id ?? a[0]?.id ?? null);
      setBooted(true);
    }).catch((e) => { if (e instanceof ApiError && e.status === 401) onLock(); });
  }, [loadAccounts, onLock]);

  // switching accounts
  useEffect(() => {
    if (!accId) return;
    localStorage.setItem("acc", accId);
    setChat(null); setQ(""); setView("list"); setDialogs(null);
    autoFor.current = null; pausedRef.current = false; setAuto({ state: "off", done: 0, total: 0, failed: 0 });
    if (acc?.authorized) loadDialogs(accId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accId, acc?.authorized]);

  // poll the chat list (serverless can't push, so we pull while the tab is visible)
  useEffect(() => {
    if (!accId || !acc?.authorized) return;
    const t = setInterval(() => { if (!document.hidden) loadDialogs(accId); }, 15000);
    return () => clearInterval(t);
  }, [accId, acc?.authorized, loadDialogs]);

  useEffect(() => {
    if (!accId || !acc?.authorized || !dialogs?.length || autoFor.current === accId) return;
    if (dialogs[0].sync === undefined) return;          // archive is off (no database)
    autoFor.current = accId;
    runAuto(accId, dialogs);
  }, [accId, acc?.authorized, dialogs, runAuto]);

  async function togglePinChat(d: Dialog) {
    if (!acc) return;
    const on = !d.app_pinned;
    try {
      if (on) await api(`/accounts/${acc.id}/chat-pins`, "POST", { c: d.id });
      else await api(`/accounts/${acc.id}/chat-pins?c=${encodeURIComponent(d.id)}`, "DELETE");
      setDialogs((l) => l && l.map((x) => (x.id === d.id ? { ...x, app_pinned: on } : x)));
      setChat((c) => (c && c.id === d.id ? { ...c, app_pinned: on } : c));
      toast(on ? t("chat.pinnedToast") : t("chat.unpinnedToast"));
    } catch (e) { toast(t("chat.pinFail", { msg: tr((e as Error).message) }), "error"); }
  }

  const archivedUnread = (dialogs || []).filter((d) => d.archived && d.unread > 0).length;
  const shown = (dialogs || []).filter((d) => {
    // like Telegram: archived chats live in their own list, not in All / Unread / People ...
    if (filter === "archived") return !!d.archived && (!q || d.name.toLowerCase().includes(q.toLowerCase()));
    if (d.archived) return false;
    if (filter === "unread" && !d.unread) return false;
    if (filter === "user" && !["user", "bot"].includes(d.type)) return false;
    if ((filter === "group" || filter === "channel") && d.type !== filter) return false;
    return !q || d.name.toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => Number(!!b.app_pinned) - Number(!!a.app_pinned));   // pinned conversations first (stable sort keeps Telegram's order)

  function pickAccount(id: string) { setAccId(id); }
  const [askOut, setAskOut] = useState(false);
  const lock = () => setAskOut(true);                       // asks first
  async function signOut() { await api("/auth/logout", "POST"); onLock(); toast(t("out.done")); }

  return (
    <div className="app" data-view={view}>
      <nav className="rail" aria-label="Accounts">
        {accounts.map((a) => (
          <button key={a.id} className={"acc" + (a.id === accId ? " on" : "")} style={{ background: avatarBg(a.id) }} onClick={() => pickAccount(a.id)}
            title={a.label + (a.me ? " · " + a.me.name : "")}>{initials(a.label)}<i className={"pip" + (a.authorized ? " ok" : "")} /></button>
        ))}
        <div className="sp" />
        <button className="rail-add" title={t("acc.add")} aria-label={t("acc.add")} onClick={() => setDlg({ acc: null })}><Ic.Plus /></button>
        {acc?.authorized && <button className="rail-out" title={t("pins.title")} aria-label={t("pins.title")} onClick={() => setPinsOpen(true)}><Ic.Pushpin /></button>}
        <button className="rail-out" title={t("settings.title")} aria-label={t("settings.title")} onClick={() => setPanel("settings")}><Ic.Sliders /></button>
        <button className="rail-out" title={t("btn.signOut")} aria-label={t("btn.signOut")} onClick={lock}><Ic.Logout /></button>
      </nav>

      <aside className="list-pane">
        <header className="list-head">
          <div className="list-title">
            <div className="switcher" ref={menuRef}>
              <button className="sw-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                <span className="sw-name">{acc ? acc.me?.name || acc.label : t("list.inbox")}</span><Ic.Chevron />
              </button>
              {menu && (
                <div className="sw-menu" role="menu">
                  {accounts.map((a) => (
                    <button key={a.id} role="menuitem" className={"sw-item" + (a.id === accId ? " on" : "")} onClick={() => { pickAccount(a.id); setMenu(false); }}>
                      <span className="sw-av" style={{ background: avatarBg(a.id) }}>{initials(a.label)}</span>
                      <span className="sw-txt"><b>{a.label}</b>
                        <small>{a.authorized ? [a.me?.name, a.me?.username && "@" + a.me.username].filter(Boolean).join(" · ") || t("menu.signedIn") : t("menu.notSignedIn")}</small></span>
                      {a.id === accId && <Ic.Check />}
                    </button>
                  ))}
                  <div className="sw-sep" />
                  <button role="menuitem" className="sw-item" onClick={() => { setMenu(false); setDlg({ acc: null }); }}>
                    <span className="sw-av plus"><Ic.Plus /></span><span className="sw-txt"><b>{t("menu.addAccount")}</b></span>
                  </button>
                  <div className="sw-sep" />
                  <div className="sw-me">{t("menu.signedInAs", { name: user.username })}{user.is_admin ? t("menu.adminSuffix") : ""}</div>
                  <button role="menuitem" className="sw-item" onClick={() => { setMenu(false); lock(); }}><span className="sw-txt"><b>{t("menu.signOut")}</b></span></button>
                </div>
              )}
            </div>
            {acc && <button className="icon-btn" title={t("acc.settings")} aria-label={t("acc.settings")} onClick={() => setDlg({ acc })}><Ic.Gear /></button>}
          </div>
          <label className="search"><span className="search-ico"><Ic.Search /></span>
            <input type="search" placeholder={t("list.searchChats")} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></label>
          <div className="chips">
            {FILTERS.map(([f, l]) => <button key={f} className={"chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{t(l)}{f === "archived" && archivedUnread > 0 && <b className="cdot">{archivedUnread}</b>}</button>)}
          </div>
        </header>
        <div className="chat-list">
          {!acc ? null : !acc.authorized ? <div className="empty-note">{t("list.notSignedIn")}</div>
            : listErr ? <div className="empty-note">{t("list.loadFail")}<br />{listErr}</div>
            : dialogs === null ? Array.from({ length: 7 }, (_, i) => <div className="skel" key={i} />)
            : !shown.length ? <div className="empty-note">{filter === "archived" && !q ? t("list.noArchived") : dialogs.length ? t("list.noMatch") : t("list.none")}</div>
            : shown.map((d) => (
              <button key={d.id} className={"chat" + (chat?.id === d.id ? " on" : "")} onClick={() => { setFocus(null); setChat(d); setView("chat"); }}>
                <Avatar accId={acc.id} d={d} />
                <div className="mid"><div className="name">{d.name}</div>
                  <div className="snip">{d.last_out && <span className="you">{t("list.you")}</span>}{d.preview_media && PREVIEW[d.preview] ? t(PREVIEW[d.preview]) : d.preview}</div></div>
                <div className="meta"><span className="time">{d.app_pinned && <span className="pinmark" title={t("list.pinned")}><Ic.Pushpin /></span>}{d.date ? fmtTime(d.date, false, locale) : ""}</span>
                  {d.unread > 0 && <span className={"badge" + (d.muted ? " muted" : "")}>{d.unread > 999 ? "999+" : d.unread}</span>}</div>
              </button>))}
        </div>
        {auto.state !== "off" && (
          <div className="autosave" role="status">
            <div className="as-txt">
              <b>{t("auto.saving")}</b><small>{t("auto.progress", { done: auto.done, total: auto.total })}{auto.failed ? t("auto.skipped", { n: auto.failed }) : ""}{auto.state === "paused" ? t("auto.paused") : ""}</small>
            </div>
            <button className="link-btn" onClick={() => { pausedRef.current = !pausedRef.current; setAuto((a) => ({ ...a, state: pausedRef.current ? "paused" : "running" })); }}>
              {auto.state === "paused" ? t("btn.resume") : t("btn.pause")}</button>
            {auto.total > 0 && <div className="as-bar"><i style={{ width: `${Math.round((auto.done / auto.total) * 100)}%` }} /></div>}
          </div>)}
      </aside>

      <main className="main-pane">
        {!booted ? <div className="center"><div className="spin" /></div>
          : !acc ? (
            <div className="center"><div className="card">
              <h2>{t("main.connectTitle")}</h2>
              <p>{t("main.connectIntro")}</p>
              <button className="btn primary" style={{ width: "100%" }} onClick={() => setDlg({ acc: null })}>{t("acc.add")}</button>
              <p className="hint"><Rich text={t("main.getKeysPre")} /> <a href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer">my.telegram.org/apps</a>.</p>
            </div></div>)
          : !acc.authorized ? <LoginCard key={acc.id} acc={acc} onEdit={() => setDlg({ acc })} onSignedIn={async () => { await loadAccounts(); }} />
          : chat ? <ChatView key={acc.id + chat.id + (focus?.n || 0)} acc={acc} chat={chat} focus={focus && focus.chat === chat.id ? focus.id : undefined} onPinChat={() => togglePinChat(chat)} onBack={() => setView("list")} onActivity={() => loadDialogs(acc.id)} />
          : <div className="center"><div className="idle"><div style={{ width: 44, margin: "0 auto 10px", opacity: .6 }}><Ic.Chat /></div>{t("main.pick")}</div></div>}
      </main>

      {askOut && (
        <ConfirmDialog title={t("out.title")} confirmLabel={t("btn.signOut")} onClose={() => setAskOut(false)} onConfirm={signOut}>
          <p>{t("out.body")}</p>
        </ConfirmDialog>)}
      {pinsOpen && acc && <PinnedDialog acc={acc} dialogs={dialogs} onClose={() => setPinsOpen(false)}
        onGo={(cid, mid) => { setPinsOpen(false); const d = dialogs?.find((x) => x.id === cid); if (d) { setChat(d); setView("chat"); setFocus({ chat: cid, id: mid, n: Date.now() }); } else toast(t("list.noMatch"), "error"); }} />}
      {panel === "settings" && <SettingsDialog username={user.username} isAdmin={user.is_admin} onClose={() => setPanel(null)}
        onPassword={() => setPanel("password")} onPeople={() => user.is_admin && setPanel("users")} />}
      {panel === "users" && <UsersDialog meId={user.id} onClose={() => setPanel(null)} />}
      {panel === "password" && <PasswordDialog onClose={() => setPanel(null)} onDone={() => setPanel(null)} />}
      {dlg && <AccountDialog acc={dlg.acc} onClose={() => setDlg(null)}
        onSaved={async (id) => { setDlg(null); await loadAccounts(); setAccId(id); }}
        onSignedOut={async () => { setDlg(null); await loadAccounts(); setChat(null); }}
        onRemoved={async () => { setDlg(null); const a = await loadAccounts(); setAccId(a[0]?.id ?? null); setView("list"); }} />}
    </div>
  );
}

function ChatView({ acc, chat, focus, onPinChat, onBack, onActivity }: { acc: Account; chat: Dialog; focus?: number; onPinChat: () => void; onBack: () => void; onActivity: () => void }) {
  const { t, tr, locale } = useI18n();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [more, setMore] = useState(false), [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState("");
  const [sq, setSq] = useState(""), [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Set<number>>(new Set());   // deleted messages the user chose to reveal
  const [meta, setMeta] = useState({ deleted: 0, archive: false });
  const [sync, setSync] = useState<string | null>(null);
  const [askSave, setAskSave] = useState(false);
  const [pinSet, setPinSet] = useState<Set<number>>(new Set());
  const [pinBusy, setPinBusy] = useState<Set<number>>(new Set());
  const [showPins, setShowPins] = useState(false);
  const [askPinChat, setAskPinChat] = useState(false);
  const scRef = useRef<HTMLDivElement>(null);
  const stick = useRef<"bottom" | { h: number } | { focus: number } | null>("bottom");
  const [around, setAround] = useState(false);           // viewing a window around a pinned message, not the latest
  const focusRef = useRef(focus);
  const base = `/accounts/${acc.id}/messages?${peerQS(chat.peer)}&c=${chat.id}`;
  const isGroup = chat.type === "group";

  const fetchFresh = useCallback(async (initial: boolean) => {
    try {
      const r = await api<{ messages: Msg[]; has_more: boolean; lo: number; deleted_count: number; archive: boolean; pins?: number[] }>(`${base}&limit=40${sq ? "&q=" + encodeURIComponent(sq) : ""}`);
      setErr(""); setMeta({ deleted: r.deleted_count, archive: r.archive });
      if (r.pins) setPinSet(new Set(r.pins));
      setMsgs((prev) => {
        if (initial || !prev || sq) { stick.current = "bottom"; setMore(r.has_more); return dedupeMsgs(r.messages); }
        // the response covers the newest window: replace that part, keep older pages already loaded
        const next = dedupeMsgs([...prev.filter((m) => m.id < r.lo), ...r.messages]);
        const sig = (a: Msg[]) => a.map((m) => m.id + (m.deleted ? "d" : "") + (m.edited ? m.text.length : "")).join();
        if (sig(next) === sig(prev)) return prev;
        const el = scRef.current;
        if (next[next.length - 1]?.id !== prev[prev.length - 1]?.id && el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) stick.current = "bottom";
        onActivity();
        return next;
      });
    } catch (e) { if (initial) setErr(tr((e as Error).message)); }
  }, [base, sq, onActivity]);

  useEffect(() => {
    if (focusRef.current && !sq) { const f = focusRef.current; focusRef.current = undefined; jumpTo(f); return; }
    setAround(false); setMsgs(null);
    const t = setTimeout(() => fetchFresh(true), sq ? 350 : 0);
    return () => clearTimeout(t);
  }, [sq]); // eslint-disable-line
  useEffect(() => {
    if (sq || around) return;                       // no live refresh while looking at an older window
    const t = setInterval(() => { if (!document.hidden) fetchFresh(false); }, 8000);
    return () => clearInterval(t);
  }, [fetchFresh, sq, around]);

  useLayoutEffect(() => {
    const el = scRef.current; if (!el || !msgs) return;
    const s = stick.current;
    if (s === "bottom") el.scrollTop = el.scrollHeight;
    else if (s && "h" in s) el.scrollTop = el.scrollHeight - s.h;
    else if (s && "focus" in s) {
      const row = el.querySelector<HTMLElement>(`[data-mid="${s.focus}"]`);
      if (row) { row.scrollIntoView({ block: "center" }); row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 2200); }
    }
    stick.current = null;
  }, [msgs]);

  /** Scrolls to a message; loads a window around it first when it is not on screen. Deleted messages are revealed. */
  async function jumpTo(id: number) {
    setShown((s) => new Set(s).add(id));
    const loaded = msgs?.some((m) => m.id === id);
    if (loaded) { stick.current = { focus: id }; setMsgs((l) => (l ? [...l] : l)); return; }
    try {
      const r = await api<{ messages: Msg[]; has_more: boolean; archive: boolean; pins?: number[]; deleted_count: number }>(`${base}&limit=40&around=${id}`);
      stick.current = { focus: id };
      setAround(true); setMore(r.has_more); setMeta({ deleted: r.deleted_count, archive: r.archive });
      if (r.pins) setPinSet(new Set(r.pins));
      setMsgs(dedupeMsgs(r.messages));
    } catch (e) { toast(tr((e as Error).message), "error"); fetchFresh(true); }
  }
  function backToLatest() { setAround(false); setMsgs(null); fetchFresh(true); }

  const loadingRef = useRef(false);
  async function loadOlder() {
    if (!msgs?.length || loadingRef.current) return;       // ignore double clicks: two identical pages would be prepended
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const r = await api<{ messages: Msg[]; has_more: boolean }>(`${base}&limit=40&before=${msgs[0].id}${sq ? "&q=" + encodeURIComponent(sq) : ""}`);
      stick.current = { h: scRef.current!.scrollHeight };
      setMsgs((cur) => dedupeMsgs([...r.messages, ...(cur || msgs)])); setMore(r.has_more);
    } catch (e) { toast(tr((e as Error).message), "error"); }
    loadingRef.current = false;
    setLoadingMore(false);
  }

  async function togglePin(m: Msg) {
    if (pinBusy.has(m.id)) return;
    const on = pinSet.has(m.id);
    setPinBusy((s) => new Set(s).add(m.id));
    try {
      if (on) await api(`/accounts/${acc.id}/pins?c=${encodeURIComponent(chat.id)}&m=${m.id}`, "DELETE");
      else await api(`/accounts/${acc.id}/pins`, "POST", { ...chat.peer, c: chat.id, m: m.id });
      setPinSet((s) => { const n = new Set(s); if (on) n.delete(m.id); else n.add(m.id); return n; });
      toast(on ? t("pins.unpinned") : t("pins.pinned"));
    } catch (e) { toast(t("pins.fail", { msg: tr((e as Error).message) }), "error"); }
    setPinBusy((s) => { const n = new Set(s); n.delete(m.id); return n; });
  }

  const pinBtn = (m: Msg) => !meta.archive ? null : (
    <button className={"pin-btn" + (pinSet.has(m.id) ? " on" : "")} disabled={pinBusy.has(m.id)}
      aria-pressed={pinSet.has(m.id)} aria-label={pinSet.has(m.id) ? t("pins.unpin") : t("pins.pin")} title={pinSet.has(m.id) ? t("pins.unpin") : t("pins.pin")}
      onClick={() => togglePin(m)}><Ic.Pushpin /></button>);

  const toggleShown = (id: number) => setShown((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function saveAll() {
    let before = 0, total = 0;
    setSync(t("chat.saving"));
    try {
      while (true) {
        const r = await api<{ saved: number; done: boolean; next_before: number | null }>(`/accounts/${acc.id}/sync`, "POST", { ...chat.peer, c: chat.id, mode: "full", before });
        total += r.saved; setSync(t("chat.savingN", { n: total.toLocaleString(locale) }));
        if (r.done) break;
        before = r.next_before!;
      }
      toast(t("chat.savedN", { n: total.toLocaleString(locale), name: chat.name }));
      fetchFresh(true);
    } catch (e) { toast(t("chat.saveFail", { msg: tr((e as Error).message) }), "error"); }
    setSync(null);
  }

  const byId = new Map((msgs || []).map((m) => [m.id, m]));
  const mediaSrc = (m: Msg) => `/api/accounts/${acc.id}/media?${peerQS(chat.peer)}&c=${chat.id}&m=${m.id}`;

  return (<>
    <header className="conv-head">
      <button className="icon-btn back" aria-label={t("chat.back")} onClick={onBack}><Ic.Back /></button>
      <Avatar accId={acc.id} d={chat} small />
      <div className="t"><b>{chat.name}</b><small>{{ user: t("chat.private"), bot: t("chat.bot"), group: t("chat.group"), channel: t("chat.channel") }[chat.type]}</small></div>
      <button className={"pill pin-chat" + (chat.app_pinned ? " on" : "")} aria-pressed={!!chat.app_pinned} onClick={() => setAskPinChat(true)}
        aria-label={chat.app_pinned ? t("chat.unpinChat") : t("chat.pinChat")} title={chat.app_pinned ? t("chat.unpinChat") : t("chat.pinChat")}>
        <Ic.Pushpin /><span className="lbl">{chat.app_pinned ? t("chat.pinnedShort") : t("chat.pinShort")}</span></button>
      {meta.archive && (
        <button className={"icon-btn pin-count" + (pinSet.size ? " has" : "")} aria-label={t("pins.inChat")} title={t("pins.inChat")} onClick={() => setShowPins(true)}>
          <Ic.Pushpin />{pinSet.size > 0 && <b>{pinSet.size}</b>}</button>
      )}
      {meta.archive && (
        <button className="icon-btn" aria-label={t("chat.saveBtn")} onClick={() => setAskSave(true)} disabled={!!sync}
          title={meta.deleted ? t("chat.saveBtnKept", { n: meta.deleted }) : t("chat.saveBtn")}><Ic.Floppy /></button>
      )}
      <div className={"in-search" + (open ? " open" : "")}>
        <input type="search" placeholder={t("chat.search")} value={sq} onChange={(e) => setSq(e.target.value.trim() ? e.target.value : "")} autoFocus={open} />
        <button className="icon-btn" aria-label={t("chat.search")} onClick={() => { if (open) setSq(""); setOpen(!open); }}><Ic.Search /></button>
      </div>
    </header>
    <div className="scroller" ref={scRef}>
      <div className="stream">
        {err ? <div className="empty-note">{t("chat.loadFail")}<br />{err}</div>
          : msgs === null ? <div className="empty-note">{t("chat.loading")}</div>
          : !msgs.length ? <div className="empty-note">{sq ? t("chat.nothing") : t("chat.empty")}</div>
          : <>
            {more && <button className="more" onClick={loadOlder} disabled={loadingMore}>{loadingMore ? t("chat.loading") : t("chat.older")}</button>}
            {msgs.map((m, i) => {
              const prev = msgs[i - 1];
              const newDay = !prev || new Date(prev.date).toDateString() !== new Date(m.date).toDateString();
              const same = !!prev && !newDay && prev.sender?.id === m.sender?.id && prev.out === m.out;
              const ref = m.reply_to ? byId.get(m.reply_to) : undefined;
              return (
                <div key={m.id} style={{ display: "contents" }}>
                  {newDay && <div className="day">{dayLabel(m.date, locale, t("date.today"), t("date.yesterday"))}</div>}
                  <div data-mid={m.id} className={"msg" + (m.out ? " out" : "") + (same ? "" : " first") + (m.deleted ? " gone" : "")}>
                    {isGroup && !m.out && (same ? <div className="gutter" />
                      : <div className="gutter"><Avatar accId={acc.id} small d={{ id: m.sender?.id || "0", name: m.sender?.name || "?" }} /></div>)}
                    {m.out && !(m.deleted && !shown.has(m.id)) && pinBtn(m)}
                    {m.deleted && !shown.has(m.id) ? (
                      <div className="bubble stub">
                        <span className="stub-t">{isGroup && !m.out && m.sender ? t("msg.deletedFrom", { name: m.sender.name }) : t("msg.deleted")}
                          {m.deleted_at ? " · " + new Date(m.deleted_at).toLocaleDateString(locale, { day: "numeric", month: "short" }) : ""}</span>
                        <button className="link-btn" onClick={() => toggleShown(m.id)}>{t("btn.show")}</button>
                      </div>
                    ) : (
                    <div className={"bubble" + (pinSet.has(m.id) ? " pinned" : "")}>
                      {isGroup && !m.out && !same && <div className="who" style={{ color: `hsl(${hue(m.sender?.id || "0")} 45% 38%)` }}>{m.sender?.name || t("msg.unknown")}</div>}
                      {ref && <div className="reply-ref">{(ref.text || t("msg.media")).slice(0, 90)}</div>}
                      {m.deleted && <div className="del-tag">{t("msg.deletedTag")}{m.deleted_at ? " · " + new Date(m.deleted_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : ""}
                        <button className="link-btn" onClick={() => toggleShown(m.id)}>{t("btn.hide")}</button></div>}
                      <MediaView m={m} src={mediaSrc(m)} />
                      {m.text && <div className="txt"><Linkified text={m.text} /></div>}
                      {m.web?.title && <div className="link-card"><b>{m.web.title}</b><span>{(m.web.description || m.web.site || "").slice(0, 140)}</span></div>}
                      {!!m.history?.length && (
                        <details className="hist"><summary>{m.history.length > 1 ? t("msg.editedVersions", { n: m.history.length }) : t("msg.editedVersion1")}</summary>
                          {m.history.map((h, k) => <div key={k} className="hist-item">{h.text}</div>)}</details>)}
                      <span className="foot">{m.edited && t("msg.edited") + " · "}{fmtTime(m.date, true, locale)}</span>
                    </div>
                    )}
                    {!m.out && !(m.deleted && !shown.has(m.id)) && pinBtn(m)}
                  </div>
                </div>);
            })}
          </>}
      </div>
    </div>
    {askPinChat && (
      <ConfirmDialog title={chat.app_pinned ? t("chat.unpinTitle") : t("chat.pinTitle")} confirmLabel={chat.app_pinned ? t("chat.unpinConfirm") : t("chat.pinConfirm")}
        onClose={() => setAskPinChat(false)} onConfirm={onPinChat}>
        <p>{chat.app_pinned ? t("chat.unpinBody", { name: chat.name }) : t("chat.pinBody", { name: chat.name })}</p>
      </ConfirmDialog>)}
    {around && <button className="to-latest" onClick={backToLatest}>{t("chat.backLatest")}</button>}
    {showPins && <PinnedDialog acc={acc} dialogs={[chat]} chat={chat} onClose={() => setShowPins(false)} onGo={(_, id) => { setShowPins(false); jumpTo(id); }} />}
    {askSave && (
      <ConfirmDialog title={t("save.title")} confirmLabel={t("save.confirm")} onClose={() => setAskSave(false)} onConfirm={saveAll}>
        <p><Rich text={t("save.intro", { name: chat.name })} /></p>
        <ul>
          <li><Rich text={t("save.b1")} /></li>
          <li><Rich text={t("save.b2")} /></li>
          <li><Rich text={t("save.b3")} /></li>
          <li><Rich text={t("save.b4")} /></li>
        </ul>
      </ConfirmDialog>)}
    <div className="readonly-bar">{sync ? sync : t("chat.readonly")}</div>
  </>);
}

/** Pinned messages (app-only): one chat when `chat` is given, otherwise every chat of the account. */
function PinnedDialog({ acc, dialogs, chat, onClose, onGo }: {
  acc: Account; dialogs: Dialog[] | null; chat?: Dialog; onClose: () => void; onGo: (chatId: string, msgId: number) => void;
}) {
  const { t, tr, locale } = useI18n();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [pins, setPins] = useState<Pin[] | null>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    api<Pin[]>(`/accounts/${acc.id}/pins${chat ? `?c=${encodeURIComponent(chat.id)}` : ""}`).then(setPins)
      .catch((e) => { toast(tr(e.message), "error"); setPins([]); });
  }, [acc.id, chat?.id]); // eslint-disable-line
  const byId = new Map((dialogs || []).map((d) => [d.id, d]));
  async function unpin(p: Pin) {
    try {
      await api(`/accounts/${acc.id}/pins?c=${encodeURIComponent(p.chat_id)}&m=${p.id}`, "DELETE");
      setPins((l) => (l || []).filter((x) => !(x.chat_id === p.chat_id && x.id === p.id)));
      toast(t("pins.unpinned"));
    } catch (e) { toast(tr((e as Error).message), "error"); }
  }
  return (
    <dialog ref={ref} className="wide" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="card">
        <h2>{chat ? t("pins.inChat") : t("pins.title")}</h2>
        <p>{t("pins.intro")}</p>
        <div className="pinlist">
          {pins === null ? <div className="empty-note">{t("chat.loading")}</div>
            : !pins.length ? <div className="empty-note">{t("pins.none")}</div>
            : pins.map((p) => {
              const d = byId.get(p.chat_id);
              return (
                <div className="pin-item" key={p.chat_id + ":" + p.id} onClick={() => onGo(p.chat_id, p.id)}>
                  <div className="pin-head">
                    <b>{!chat && (d?.name || "")}{!chat && d && p.sender && !p.out ? " · " : ""}{p.out ? "" : p.sender?.name || ""}</b>
                    <small>{new Date(p.date).toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
                  </div>
                  {p.deleted && <div className="del-tag">{t("pins.deletedNote")}</div>}
                  {d && p.media && <MediaView m={p} src={`/api/accounts/${acc.id}/media?${peerQS(d.peer)}&c=${d.id}&m=${p.id}`} />}
                  {p.text && <div className="txt"><Linkified text={p.text} /></div>}
                  <div className="pin-actions">
                    {d && <button className="link-btn" onClick={(e) => { e.stopPropagation(); onGo(p.chat_id, p.id); }}>{t("pins.open")}</button>}
                    <button className="link-btn" onClick={(e) => { e.stopPropagation(); unpin(p); }}>{t("pins.unpin")}</button>
                  </div>
                </div>);
            })}
        </div>
        <div className="actions"><button className="btn" onClick={() => ref.current?.close()}>{t("btn.close")}</button></div>
      </div>
    </dialog>
  );
}
