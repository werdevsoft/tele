"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function Gate({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/auth/login", "POST", { password: pw }); onDone(); }
    catch (ex: any) { setErr(ex.message); setBusy(false); }
  }
  return (
    <div className="gate">
      <form className="card" onSubmit={submit}>
        <h2>Inbox</h2>
        <p>Enter the app password to continue.</p>
        <label className="field"><span>Password</span>
          <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
        <div className="err">{err}</div>
        <button className="btn primary" style={{ width: "100%" }} disabled={busy || !pw}>Unlock</button>
      </form>
    </div>
  );
}
