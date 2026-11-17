"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

type U = { id: string; username: string; is_admin: boolean; accounts: number };

export default function UsersDialog({ meId, onClose }: { meId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [users, setUsers] = useState<U[] | null>(null);
  const [name, setName] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState(""), [note, setNote] = useState("");
  const load = useCallback(() => api<U[]>("/users").then(setUsers).catch((e) => setErr(e.message)), []);
  useEffect(() => { ref.current?.showModal(); load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setNote("");
    try { await api("/users", "POST", { username: name, password: pw }); setNote(`Created “${name.trim().toLowerCase()}”. Share the username and password with them.`); setName(""); setPw(""); load(); }
    catch (ex: any) { setErr(ex.message); }
  }
  async function reset(u: U) {
    const p = prompt(`New password for ${u.username} (8+ characters). They will be signed out everywhere.`);
    if (!p) return;
    setErr(""); setNote("");
    try { await api(`/users/${u.id}`, "PATCH", { password: p }); setNote(`Password for ${u.username} changed.`); } catch (ex: any) { setErr(ex.message); }
  }
  async function remove(u: U) {
    if (!confirm(`Remove “${u.username}”?\n\nThis deletes their Telegram accounts from this app AND their archived messages. It cannot be undone. Their real Telegram accounts are not affected.`)) return;
    setErr(""); setNote("");
    try { await api(`/users/${u.id}`, "DELETE"); load(); } catch (ex: any) { setErr(ex.message); }
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="card">
        <h2>People</h2>
        <p>Everyone signs in with their own username and sees only their own Telegram accounts. Not even you can open theirs from inside the app.</p>
        <div className="ulist">
          {users === null ? <div className="empty-note">Loading…</div> : users.map((u) => (
            <div className="urow" key={u.id}>
              <div className="utxt"><b>{u.username}</b>{u.is_admin && <span className="tag">admin</span>}<small>{u.accounts} Telegram account{u.accounts === 1 ? "" : "s"}</small></div>
              <button className="btn sm" onClick={() => reset(u)}>Reset password</button>
              {u.id !== meId && <button className="btn sm danger" onClick={() => remove(u)}>Remove</button>}
            </div>))}
        </div>
        <div className="sep" />
        <form onSubmit={add}>
          <div className="row">
            <label className="field"><span>New username</span><input value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" spellCheck={false} autoComplete="off" /></label>
            <label className="field"><span>Password</span><input value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" placeholder="8+ characters" /></label>
          </div>
          <div className="err">{err}</div>
          {note && <div className="ok">{note}</div>}
          <div className="actions"><button type="button" className="btn" onClick={() => ref.current?.close()}>Close</button><button className="btn primary" disabled={!name || !pw}>Add person</button></div>
        </form>
      </div>
    </dialog>
  );
}
