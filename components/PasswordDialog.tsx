"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

export default function PasswordDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t, tr } = useI18n();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [cur, setCur] = useState(""), [next, setNext] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/auth/password", "POST", { current: cur, next }); toast(t("pw.changed")); onDone(); }
    catch (ex: any) { setErr(tr(ex.message)); setBusy(false); }
  }
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <form className="card" onSubmit={save}>
        <h2>{t("pw.title")}</h2><p>{t("pw.intro")}</p>
        <label className="field"><span>{t("pw.current")}</span><input type="password" autoFocus value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
        <label className="field"><span>{t("pw.new")}</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
        <div className="err">{err}</div>
        <div className="actions"><button type="button" className="btn" onClick={() => ref.current?.close()}>{t("btn.cancel")}</button><button className="btn primary" disabled={busy || !cur || !next}>{t("btn.save")}</button></div>
      </form>
    </dialog>
  );
}
