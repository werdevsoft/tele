"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export type Me = { id: string; username: string; is_admin: boolean };

export default function Gate({ setup, onDone }: { setup: boolean; onDone: (u: Me) => void }) {
  const [username, setUsername] = useState(""), [pw, setPw] = useState(""), [key, setKey] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = setup ? await api("/auth/setup", "POST", { username, password: pw, setup_key: key })
                      : await api("/auth/login", "POST", { username, password: pw });
      onDone(r.user);
    } catch (ex: any) { setErr(ex.message); setBusy(false); }
  }
  return (
    <div className="gate">
      <form className="card" onSubmit={submit}>
        <h2>{setup ? "Create the admin account" : "Inbox"}</h2>
        <p>{setup ? "First run. You'll be the admin and can add accounts for family from inside the app." : "Sign in to continue."}</p>
        <label className="field"><span>Username</span>
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
        <label className="field"><span>{setup ? "Choose a password (8+ characters)" : "Password"}</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={setup ? "new-password" : "current-password"} /></label>
        {setup && <label className="field"><span>Setup key</span>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" placeholder="APP_PASSWORD from the server settings" /></label>}
        <div className="err">{err}</div>
        <button className="btn primary" style={{ width: "100%" }} disabled={busy || !username || !pw || (setup && !key)}>{setup ? "Create admin" : "Sign in"}</button>
      </form>
    </div>
  );
}
