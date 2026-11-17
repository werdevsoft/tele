"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Kind = "ok" | "error";
type T = { id: number; msg: string; kind: Kind };
const C = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const n = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const push = useCallback((msg: string, kind: Kind = "ok") => {
    const id = ++n.current;
    setItems((l) => [...l.slice(-3), { id, msg, kind }]);
    setTimeout(() => dismiss(id), kind === "error" ? 6500 : 3500);
  }, [dismiss]);
  return (
    <C.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((x) => (
          <button key={x.id} className={"toast-item " + x.kind} onClick={() => dismiss(x.id)}>
            <i aria-hidden />{x.msg}<span className="x" aria-hidden>×</span>
          </button>
        ))}
      </div>
    </C.Provider>
  );
}
export const useToast = () => useContext(C);
