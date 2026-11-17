"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Ic from "./Icons";
import AccountDialog from "./AccountDialog";
import LoginCard from "./LoginCard";
import { Account, Dialog, Msg, api, ApiError, avatarBg, dayLabel, fmtDur, fmtSize, fmtTime, hue, initials, peerQS } from "@/lib/client";

const FILTERS = [["all", "All"], ["unread", "Unread"], ["user", "People"], ["group", "Groups"], ["channel", "Channels"]] as const;

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
  const k = m.media; if (!k) return null;
  const Att = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => <div className="attach">{icon}<span>{children}</span></div>;
  if (["photo", "sticker", "video", "video_note"].includes(k.kind)) {
    const label = k.kind === "photo" ? "Photo" : k.kind === "sticker" ? k.name || "Sticker" : "Video";
    return (<>
      {!bad && <img className="thumb" style={k.kind === "sticker" ? { maxHeight: 160, background: "none" } : undefined} loading="lazy" src={src} alt={label} onError={() => setBad(true)} />}
      {(bad || k.kind.startsWith("video")) && <Att icon={k.kind.startsWith("video") ? <Ic.Play /> : <Ic.File />}>{label}{k.duration ? <> <small>{fmtDur(k.duration)}</small></> : null}</Att>}
    </>);
  }
  if (k.kind === "voice") return <Att icon={<Ic.Mic />}>Voice message{k.duration ? <> <small>{fmtDur(k.duration)}</small></> : null}</Att>;
  if (k.kind === "location") return <Att icon={<Ic.Pin />}>Location</Att>;
  if (k.kind === "file" || k.kind === "audio") return <Att icon={<Ic.File />}>{k.name || (k.kind === "audio" ? "Audio" : "File")}{k.size ? <> <small>{fmtSize(k.size)}</small></> : null}</Att>;
  return <Att icon={<Ic.File />}>{k.kind[0].toUpperCase() + k.kind.slice(1)}</Att>;
}

export default function Reader({ onLock }: { onLock: () => void }) {
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
  const acc = accounts.find((a) => a.id === accId) || null;

  const loadAccounts = useCallback(async () => { const a = await api<Account[]>("/accounts"); setAccounts(a); return a; }, []);

  const loadDialogs = useCallback(async (id: string, first = false) => {
    if (first) { setDialogs(null); setListErr(""); }
    try {
      const d = await api<Dialog[]>(`/accounts/${id}/dialogs?limit=150`);
      if (accRef.current === id) { setDialogs(d); setListErr(""); }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { await loadAccounts(); return; }
      if (accRef.current === id && first) setListErr((e as Error).message);
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
    if (acc?.authorized) loadDialogs(accId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accId, acc?.authorized]);

  // poll the chat list (serverless can't push, so we pull while the tab is visible)
  useEffect(() => {
    if (!accId || !acc?.authorized) return;
    const t = setInterval(() => { if (!document.hidden) loadDialogs(accId); }, 15000);
    return () => clearInterval(t);
  }, [accId, acc?.authorized, loadDialogs]);

  const shown = (dialogs || []).filter((d) => {
    if (filter === "unread" && !d.unread) return false;
    if (filter === "user" && !["user", "bot"].includes(d.type)) return false;
    if ((filter === "group" || filter === "channel") && d.type !== filter) return false;
    return !q || d.name.toLowerCase().includes(q.toLowerCase());
  });

  function pickAccount(id: string) { setAccId(id); }
  async function lock() { await api("/auth/logout", "POST"); onLock(); }

  return (
    <div className="app" data-view={view}>
      <nav className="rail" aria-label="Accounts">
        {accounts.map((a) => (
          <button key={a.id} className={"acc" + (a.id === accId ? " on" : "")} style={{ background: avatarBg(a.id) }} onClick={() => pickAccount(a.id)}
            title={a.label + (a.me ? " · " + a.me.name : "")}>{initials(a.label)}<i className={"pip" + (a.authorized ? " ok" : "")} /></button>
        ))}
        <div className="sp" />
        <button className="rail-add" title="Add account" aria-label="Add account" onClick={() => setDlg({ acc: null })}><Ic.Plus /></button>
        <button className="rail-out" title="Lock" aria-label="Lock" onClick={lock}><Ic.Lock /></button>
      </nav>

      <aside className="list-pane">
        <header className="list-head">
          <div className="list-title">
            <div className="switcher" ref={menuRef}>
              <button className="sw-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                <span className="sw-name">{acc ? acc.me?.name || acc.label : "Inbox"}</span><Ic.Chevron />
              </button>
              {menu && (
                <div className="sw-menu" role="menu">
                  {accounts.map((a) => (
                    <button key={a.id} role="menuitem" className={"sw-item" + (a.id === accId ? " on" : "")} onClick={() => { pickAccount(a.id); setMenu(false); }}>
                      <span className="sw-av" style={{ background: avatarBg(a.id) }}>{initials(a.label)}</span>
                      <span className="sw-txt"><b>{a.label}</b>
                        <small>{a.authorized ? [a.me?.name, a.me?.username && "@" + a.me.username].filter(Boolean).join(" · ") || "Signed in" : "Not signed in"}</small></span>
                      {a.id === accId && <Ic.Check />}
                    </button>
                  ))}
                  <div className="sw-sep" />
                  <button role="menuitem" className="sw-item" onClick={() => { setMenu(false); setDlg({ acc: null }); }}>
                    <span className="sw-av plus"><Ic.Plus /></span><span className="sw-txt"><b>Add account</b></span>
                  </button>
                </div>
              )}
            </div>
            {acc && <button className="icon-btn" title="Account settings" aria-label="Account settings" onClick={() => setDlg({ acc })}><Ic.Gear /></button>}
          </div>
          <label className="search"><span className="search-ico"><Ic.Search /></span>
            <input type="search" placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></label>
          <div className="chips">
            {FILTERS.map(([f, l]) => <button key={f} className={"chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{l}</button>)}
          </div>
        </header>
        <div className="chat-list">
          {!acc ? null : !acc.authorized ? <div className="empty-note">Not signed in yet.</div>
            : listErr ? <div className="empty-note">Could not load chats.<br />{listErr}</div>
            : dialogs === null ? Array.from({ length: 7 }, (_, i) => <div className="skel" key={i} />)
            : !shown.length ? <div className="empty-note">{dialogs.length ? "No chats match." : "No chats yet."}</div>
            : shown.map((d) => (
              <button key={d.id} className={"chat" + (chat?.id === d.id ? " on" : "")} onClick={() => { setChat(d); setView("chat"); }}>
                <Avatar accId={acc.id} d={d} />
                <div className="mid"><div className="name">{d.name}</div>
                  <div className="snip">{d.last_out && <span className="you">You: </span>}{d.preview}</div></div>
                <div className="meta"><span className="time">{d.date ? fmtTime(d.date) : ""}</span>
                  {d.unread > 0 && <span className={"badge" + (d.muted ? " muted" : "")}>{d.unread > 999 ? "999+" : d.unread}</span>}</div>
              </button>))}
        </div>
      </aside>

      <main className="main-pane">
        {!booted ? <div className="center"><div className="spin" /></div>
          : !acc ? (
            <div className="center"><div className="card">
              <h2>Connect a Telegram account</h2>
              <p>Add your API credentials, then sign in with your phone number. Credentials and sessions are stored encrypted.</p>
              <button className="btn primary" style={{ width: "100%" }} onClick={() => setDlg({ acc: null })}>Add account</button>
              <p className="hint">Get an <b>api_id</b> and <b>api_hash</b> at <a href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer">my.telegram.org/apps</a>.</p>
            </div></div>)
          : !acc.authorized ? <LoginCard key={acc.id} acc={acc} onEdit={() => setDlg({ acc })} onSignedIn={async () => { await loadAccounts(); }} />
          : chat ? <ChatView key={acc.id + chat.id} acc={acc} chat={chat} onBack={() => setView("list")} onActivity={() => loadDialogs(acc.id)} />
          : <div className="center"><div className="idle"><div style={{ width: 44, margin: "0 auto 10px", opacity: .6 }}><Ic.Chat /></div>Pick a chat to start reading</div></div>}
      </main>

      {dlg && <AccountDialog acc={dlg.acc} onClose={() => setDlg(null)}
        onSaved={async (id) => { setDlg(null); await loadAccounts(); setAccId(id); }}
        onSignedOut={async () => { setDlg(null); await loadAccounts(); setChat(null); }}
        onRemoved={async () => { setDlg(null); const a = await loadAccounts(); setAccId(a[0]?.id ?? null); setView("list"); }} />}
    </div>
  );
}

function ChatView({ acc, chat, onBack, onActivity }: { acc: Account; chat: Dialog; onBack: () => void; onActivity: () => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [more, setMore] = useState(false), [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState("");
  const [sq, setSq] = useState(""), [open, setOpen] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [meta, setMeta] = useState({ deleted: 0, archive: false });
  const [sync, setSync] = useState<string | null>(null);
  useEffect(() => { try { setShowDel(localStorage.getItem("showDeleted") === "1"); } catch {} }, []);
  const scRef = useRef<HTMLDivElement>(null);
  const stick = useRef<"bottom" | { h: number } | null>("bottom");
  const base = `/accounts/${acc.id}/messages?${peerQS(chat.peer)}&c=${chat.id}${showDel ? "&deleted=1" : ""}`;
  const isGroup = chat.type === "group";

  const fetchFresh = useCallback(async (initial: boolean) => {
    try {
      const r = await api<{ messages: Msg[]; has_more: boolean; lo: number; deleted_count: number; archive: boolean }>(`${base}&limit=40${sq ? "&q=" + encodeURIComponent(sq) : ""}`);
      setErr(""); setMeta({ deleted: r.deleted_count, archive: r.archive });
      setMsgs((prev) => {
        if (initial || !prev || sq) { stick.current = "bottom"; setMore(r.has_more); return r.messages; }
        // the response covers the newest window: replace that part, keep older pages already loaded
        const next = [...prev.filter((m) => m.id < r.lo), ...r.messages];
        const sig = (a: Msg[]) => a.map((m) => m.id + (m.deleted ? "d" : "") + (m.edited ? m.text.length : "")).join();
        if (sig(next) === sig(prev)) return prev;
        const el = scRef.current;
        if (next[next.length - 1]?.id !== prev[prev.length - 1]?.id && el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) stick.current = "bottom";
        onActivity();
        return next;
      });
    } catch (e) { if (initial) setErr((e as Error).message); }
  }, [base, sq, onActivity]);

  useEffect(() => { setMsgs(null); const t = setTimeout(() => fetchFresh(true), sq ? 350 : 0); return () => clearTimeout(t); }, [sq, showDel]); // eslint-disable-line
  useEffect(() => {
    if (sq) return;
    const t = setInterval(() => { if (!document.hidden) fetchFresh(false); }, 8000);
    return () => clearInterval(t);
  }, [fetchFresh, sq]);

  useLayoutEffect(() => {
    const el = scRef.current; if (!el || !msgs) return;
    const s = stick.current;
    if (s === "bottom") el.scrollTop = el.scrollHeight;
    else if (s) el.scrollTop = el.scrollHeight - s.h;
    stick.current = null;
  }, [msgs]);

  async function loadOlder() {
    if (!msgs?.length) return;
    setLoadingMore(true);
    try {
      const r = await api<{ messages: Msg[]; has_more: boolean }>(`${base}&limit=40&before=${msgs[0].id}${sq ? "&q=" + encodeURIComponent(sq) : ""}`);
      stick.current = { h: scRef.current!.scrollHeight };
      setMsgs([...r.messages, ...msgs]); setMore(r.has_more);
    } catch (e) { setErr((e as Error).message); }
    setLoadingMore(false);
  }

  function toggleDel() { const v = !showDel; setShowDel(v); try { localStorage.setItem("showDeleted", v ? "1" : "0"); } catch {} }

  async function saveAll() {
    let before = 0, total = 0;
    setSync("Saving…");
    try {
      while (true) {
        const r = await api<{ saved: number; done: boolean; next_before: number | null }>(`/accounts/${acc.id}/sync`, "POST", { ...chat.peer, c: chat.id, before });
        total += r.saved; setSync(`Saving… ${total.toLocaleString()}`);
        if (r.done) break;
        before = r.next_before!;
      }
      setSync(`Saved ${total.toLocaleString()} messages`);
      fetchFresh(true);
    } catch (e) { setSync("Failed: " + (e as Error).message); }
    setTimeout(() => setSync(null), 4000);
  }

  const byId = new Map((msgs || []).map((m) => [m.id, m]));
  const mediaSrc = (m: Msg) => `/api/accounts/${acc.id}/media?${peerQS(chat.peer)}&c=${chat.id}&m=${m.id}`;

  return (<>
    <header className="conv-head">
      <button className="icon-btn back" aria-label="Back" onClick={onBack}><Ic.Back /></button>
      <Avatar accId={acc.id} d={chat} small />
      <div className="t"><b>{chat.name}</b><small>{{ user: "Private chat", bot: "Bot", group: "Group", channel: "Channel" }[chat.type]}</small></div>
      {meta.archive && <>
        <button className={"pill" + (showDel ? " on" : "")} onClick={toggleDel} aria-pressed={showDel} title="Show messages that were deleted or edited on Telegram">
          Deleted{meta.deleted > 0 && <b>{meta.deleted}</b>}</button>
        <button className="icon-btn" aria-label="Save full history" title="Save this chat's full history to the archive" onClick={saveAll} disabled={sync?.startsWith("Saving")}><Ic.Archive /></button>
      </>}
      <div className={"in-search" + (open ? " open" : "")}>
        <input type="search" placeholder="Search in chat" value={sq} onChange={(e) => setSq(e.target.value.trim() ? e.target.value : "")} autoFocus={open} />
        <button className="icon-btn" aria-label="Search in chat" onClick={() => { if (open) setSq(""); setOpen(!open); }}><Ic.Search /></button>
      </div>
    </header>
    <div className="scroller" ref={scRef}>
      <div className="stream">
        {err ? <div className="empty-note">Could not load messages.<br />{err}</div>
          : msgs === null ? <div className="empty-note">Loading…</div>
          : !msgs.length ? <div className="empty-note">{sq ? "Nothing found." : "No messages."}</div>
          : <>
            {more && <button className="more" onClick={loadOlder} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load earlier messages"}</button>}
            {msgs.map((m, i) => {
              const prev = msgs[i - 1];
              const newDay = !prev || new Date(prev.date).toDateString() !== new Date(m.date).toDateString();
              const same = !!prev && !newDay && prev.sender?.id === m.sender?.id && prev.out === m.out;
              const ref = m.reply_to ? byId.get(m.reply_to) : undefined;
              return (
                <div key={m.id} style={{ display: "contents" }}>
                  {newDay && <div className="day">{dayLabel(m.date)}</div>}
                  <div className={"msg" + (m.out ? " out" : "") + (same ? "" : " first") + (m.deleted ? " gone" : "")}>
                    {isGroup && !m.out && (same ? <div className="gutter" />
                      : <div className="gutter"><Avatar accId={acc.id} small d={{ id: m.sender?.id || "0", name: m.sender?.name || "?" }} /></div>)}
                    <div className="bubble">
                      {isGroup && !m.out && !same && <div className="who" style={{ color: `hsl(${hue(m.sender?.id || "0")} 45% 38%)` }}>{m.sender?.name || "Unknown"}</div>}
                      {ref && <div className="reply-ref">{(ref.text || "Media").slice(0, 90)}</div>}
                      {m.deleted && <div className="del-tag">Deleted{m.deleted_at ? " · " + new Date(m.deleted_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : ""}</div>}
                      <MediaView m={m} src={mediaSrc(m)} />
                      {m.text && <div className="txt"><Linkified text={m.text} /></div>}
                      {m.web?.title && <div className="link-card"><b>{m.web.title}</b><span>{(m.web.description || m.web.site || "").slice(0, 140)}</span></div>}
                      {showDel && !!m.history?.length && (
                        <details className="hist"><summary>Edited · {m.history.length} earlier version{m.history.length > 1 ? "s" : ""}</summary>
                          {m.history.map((h, k) => <div key={k} className="hist-item">{h.text}</div>)}</details>)}
                      <span className="foot">{m.edited && "edited · "}{fmtTime(m.date, true)}</span>
                    </div>
                  </div>
                </div>);
            })}
          </>}
      </div>
    </div>
    <div className="readonly-bar">{sync ? sync : "Read-only · opening a chat here won’t mark messages as read in Telegram"}</div>
  </>);
}
