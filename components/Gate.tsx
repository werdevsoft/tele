"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { LangSwitch, useI18n } from "@/lib/i18n";

export type Me = { id: string; username: string; is_admin: boolean };

export default function Gate({ setup, onDone }: { setup: boolean; onDone: (u: Me) => void }) {
  const { t, tr } = useI18n();
  const [username, setUsername] = useState(""), [pw, setPw] = useState(""), [key, setKey] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = setup ? await api("/auth/setup", "POST", { username, password: pw, setup_key: key })
                      : await api("/auth/login", "POST", { username, password: pw });
      onDone(r.user);
    } catch (ex: any) { setErr(tr(ex.message)); setBusy(false); }
  }
  return (
    <div className="gate">
      <LangSwitch />
      <form className="card" onSubmit={submit}>
        <h2>{setup ? t("gate.setupTitle") : t("gate.title")}</h2>
        <p>{setup ? t("gate.setupIntro") : t("gate.signInIntro")}</p>
        <label className="field"><span>{t("field.username")}</span>
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
        <label className="field"><span>{setup ? t("gate.choosePw") : t("field.password")}</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={setup ? "new-password" : "current-password"} /></label>
        {setup && <label className="field"><span>{t("gate.setupKey")}</span>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" placeholder={t("gate.setupKeyPh")} /></label>}
        <div className="err">{err}</div>
        <button className="btn primary" style={{ width: "100%" }} disabled={busy || !username || !pw || (setup && !key)}>{setup ? t("gate.createAdmin") : t("gate.signIn")}</button>
      </form>
    </div>
  );
}
