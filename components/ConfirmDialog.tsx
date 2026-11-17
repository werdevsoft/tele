"use client";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

export default function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, danger }: {
  title: string; children: React.ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="card">
        <h2>{title}</h2>
        <div className="explain">{children}</div>
        <div className="actions">
          <button className="btn" onClick={() => ref.current?.close()}>{t("btn.cancel")}</button>
          <button className={"btn primary" + (danger ? " warn" : "")} autoFocus onClick={() => { ref.current?.close(); onConfirm(); }}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
