"use client";
import { useEffect, useRef } from "react";
import { LangSwitch, useI18n } from "@/lib/i18n";

/** App settings. People management is only offered to admins (and enforced again on the server). */
export default function SettingsDialog({ username, isAdmin, onClose, onPassword, onPeople }: {
  username: string; isAdmin: boolean; onClose: () => void; onPassword: () => void; onPeople: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const go = (fn: () => void) => () => { ref.current?.close(); fn(); };
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="card">
        <h2>{t("settings.title")}</h2>
        <p>{t("menu.signedInAs", { name: username })}{isAdmin ? t("menu.adminSuffix") : ""}</p>
        <div className="srow">
          <div className="stxt"><b>{t("field.language")}</b></div>
          <LangSwitch />
        </div>
        <div className="srow">
          <div className="stxt"><b>{t("settings.password")}</b><small>{t("settings.passwordHint")}</small></div>
          <button className="btn sm" onClick={go(onPassword)}>{t("settings.change")}</button>
        </div>
        {isAdmin && (
          <div className="srow">
            <div className="stxt"><b>{t("settings.people")}</b><small>{t("settings.peopleHint")}</small></div>
            <button className="btn sm" onClick={go(onPeople)}>{t("settings.manage")}</button>
          </div>
        )}
        <div className="actions"><button className="btn" onClick={() => ref.current?.close()}>{t("btn.close")}</button></div>
      </div>
    </dialog>
  );
}
