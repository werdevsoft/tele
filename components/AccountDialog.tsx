"use client";
import { useEffect, useRef, useState } from "react";
import { Account, api } from "@/lib/client";

export default function AccountDialog({ acc, onClose, onSaved, onRemoved, onSignedOut }: {
  acc: Account | null; onClose: () => void; onSaved: (id: string) => void; onRemoved: () => void; onSignedOut: (id: string) => void;
}) {
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
      onSaved(r.id);
    } catch (ex: any) { setErr(ex.message); setBusy(false); }
  }
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <form className="card" onSubmit={save}>
        <h2>{edit ? "Account settings" : "Add account"}</h2>
        <p>{edit ? "Swap the API keys or rename this account. New keys sign the account out." : "Each account has its own API keys and session."}</p>
        <label className="field"><span>Name</span><input required autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Personal, Work…" /></label>
        <div className="row">
          <label className="field"><span>api_id</span><input required inputMode="numeric" pattern="[0-9]+" value={apiId} onChange={(e) => setApiId(e.target.value)} /></label>
          <label className="field" style={{ flex: 2 }}><span>api_hash</span>
            <input required={!edit} value={hash} onChange={(e) => setHash(e.target.value)} placeholder={edit ? "Leave blank to keep current" : ""} autoComplete="off" spellCheck={false} /></label>
        </div>
        <div className="err">{err}</div>
        <div className="actions"><button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button><button className="btn primary" disabled={busy}>{edit ? "Save" : "Add account"}</button></div>
        {edit ? (
          <><div className="sep" /><div className="actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="btn danger" onClick={async () => {
              if (!confirm(`Remove “${acc!.label}” from this app? Its stored session is deleted, but messages already saved in your archive are kept. Your Telegram account is not affected.`)) return;
              await api(`/accounts/${acc!.id}`, "DELETE"); onRemoved();
            }}>Remove account</button>
            {acc!.authorized && <button type="button" className="btn" onClick={async () => { await api(`/accounts/${acc!.id}/logout`, "POST"); onSignedOut(acc!.id); }}>Sign out</button>}
          </div></>
        ) : <p className="hint">Get the keys at <a href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer">my.telegram.org/apps</a>.</p>}
      </form>
    </dialog>
  );
}
