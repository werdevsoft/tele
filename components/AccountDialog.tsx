"use client";
import { useEffect, useRef, useState } from "react";
import { Account, api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

export default function AccountDialog({ acc, onClose, onSaved, onRemoved, onSignedOut }: {
  acc: Account | null; onClose: () => void; onSaved: (id: string) => void; onRemoved: () => void; onSignedOut: (id: string) => void;
}) {
  const { t, tr } = useI18n();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(acc?.label ?? ""), [apiId, setApiId] = useState(acc ? String(acc.api_id) : ""), [hash, setHash] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const edit = !!acc;
  useEffect(() => { ref.current?.showModal(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const body: any = { label, api_id: Number(apiId) }; if (hash.trim()) body.api_hash = hash.trim();
      const r = edit ? await api(`/accounts/${acc!.id}`, "PATCH", body) : await api("/accounts", "POST", body);
      toast(edit ? t("acc.saved") : t("acc.added", { label: r.label }));
      onSaved(r.id);
    } catch (ex: any) { setErr(tr(ex.message)); setBusy(false); }
  }
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <form className="card" onSubmit={save}>
        <h2>{edit ? t("acc.settings") : t("acc.add")}</h2>
        <p>{edit ? t("acc.editIntro") : t("acc.addIntro")}</p>
        <label className="field"><span>{t("acc.name")}</span><input required autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("acc.namePh")} /></label>
        <div className="row">
          <label className="field"><span>api_id</span><input required inputMode="numeric" pattern="[0-9]+" value={apiId} onChange={(e) => setApiId(e.target.value)} /></label>
          <label className="field" style={{ flex: 2 }}><span>api_hash</span>
            <input required={!edit} value={hash} onChange={(e) => setHash(e.target.value)} placeholder={edit ? t("acc.hashKeep") : ""} autoComplete="off" spellCheck={false} /></label>
        </div>
        <div className="err">{err}</div>
        <div className="actions"><button type="button" className="btn" onClick={() => ref.current?.close()}>{t("btn.cancel")}</button><button className="btn primary" disabled={busy}>{edit ? t("btn.save") : t("acc.add")}</button></div>
        {edit ? (
          <><div className="sep" /><div className="actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="btn danger" onClick={async () => {
              if (!confirm(t("acc.removeConfirm", { label: acc!.label }))) return;
              try { await api(`/accounts/${acc!.id}`, "DELETE"); toast(t("acc.removed")); onRemoved(); } catch (ex: any) { toast(tr(ex.message), "error"); }
            }}>{t("acc.remove")}</button>
            {acc!.authorized && <button type="button" className="btn" onClick={async () => {
              try { await api(`/accounts/${acc!.id}/logout`, "POST"); toast(t("acc.signedOut")); onSignedOut(acc!.id); } catch (ex: any) { toast(tr(ex.message), "error"); }
            }}>{t("btn.signOut")}</button>}
          </div></>
        ) : <p className="hint">{t("acc.getKeys")} <a href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer">my.telegram.org/apps</a>.</p>}
      </form>
    </dialog>
  );
}
