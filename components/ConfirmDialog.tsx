"use client";
import { useEffect, useRef } from "react";

export default function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose }: {
  title: string; children: React.ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="card">
        <h2>{title}</h2>
        <div className="explain">{children}</div>
        <div className="actions">
          <button className="btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button className="btn primary" autoFocus onClick={() => { ref.current?.close(); onConfirm(); }}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
