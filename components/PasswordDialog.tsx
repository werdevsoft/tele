"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

export default function PasswordDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [cur, setCur] = useState(""), [next, setNext] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/auth/password", "POST", { current: cur, next }); onDone(); }
    catch (ex: any) { setErr(ex.message); setBusy(false); }
  }
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <form className="card" onSubmit={save}>
        <h2>Change password</h2><p>Other browsers where you're signed in will be signed out.</p>
        <label className="field"><span>Current password</span><input type="password" autoFocus value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
        <label className="field"><span>New password (8+ characters)</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
        <div className="err">{err}</div>
        <div className="actions"><button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button><button className="btn primary" disabled={busy || !cur || !next}>Save</button></div>
      </form>
    </dialog>
  );
}
