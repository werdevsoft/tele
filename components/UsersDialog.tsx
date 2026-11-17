"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

type U = { id: string; username: string; is_admin: boolean; accounts: number };

export default function UsersDialog({ meId, onClose }: { meId: string; onClose: () => void }) {
  const { t, tr } = useI18n();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [users, setUsers] = useState<U[] | null>(null);
  const [name, setName] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState("");
  const load = useCallback(() => api<U[]>("/users").then(setUsers).catch((e) => toast(tr(e.message), "error")), []); // eslint-disable-line
  useEffect(() => { ref.current?.showModal(); load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try { const uname = name.trim().toLowerCase(); await api("/users", "POST", { username: name, password: pw }); toast(t("users.created", { name: uname })); setName(""); setPw(""); load(); }
    catch (ex: any) { setErr(tr(ex.message)); }
  }
  async function reset(u: U) {
    const p = prompt(t("users.resetPrompt", { name: u.username }));
    if (!p) return;
    try { await api(`/users/${u.id}`, "PATCH", { password: p }); toast(t("users.resetDone", { name: u.username })); } catch (ex: any) { toast(tr(ex.message), "error"); }
  }
  async function remove(u: U) {
    if (!confirm(t("users.removeConfirm", { name: u.username }))) return;
    try { await api(`/users/${u.id}`, "DELETE"); toast(t("users.removed", { name: u.username })); load(); } catch (ex: any) { toast(tr(ex.message), "error"); }
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="card">
        <h2>{t("users.title")}</h2>
        <p>{t("users.intro")}</p>
        <div className="ulist">
          {users === null ? <div className="empty-note">{t("chat.loading")}</div> : users.map((u) => (
            <div className="urow" key={u.id}>
              <div className="utxt"><b>{u.username}</b>{u.is_admin && <span className="tag">{t("users.admin")}</span>}<small>{u.accounts === 1 ? t("users.accounts1") : t("users.accounts", { n: u.accounts })}</small></div>
              <button className="btn sm" onClick={() => reset(u)}>{t("users.reset")}</button>
              {u.id !== meId && <button className="btn sm danger" onClick={() => remove(u)}>{t("users.remove")}</button>}
            </div>))}
        </div>
        <div className="sep" />
        <form onSubmit={add}>
          <div className="row">
            <label className="field"><span>{t("users.newName")}</span><input value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" spellCheck={false} autoComplete="off" /></label>
            <label className="field"><span>{t("field.password")}</span><input value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" placeholder={t("users.pwPh")} /></label>
          </div>
          <div className="err">{err}</div>
          <div className="actions"><button type="button" className="btn" onClick={() => ref.current?.close()}>{t("btn.close")}</button><button className="btn primary" disabled={!name || !pw}>{t("users.add")}</button></div>
        </form>
      </div>
    </dialog>
  );
}
