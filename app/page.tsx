"use client";
import { useCallback, useEffect, useState } from "react";
import Reader from "@/components/Reader";
import Gate, { Me } from "@/components/Gate";

export default function Page() {
  const [st, setSt] = useState<{ user: Me | null; setup: boolean } | null>(null);
  const load = useCallback(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setSt(d.user !== undefined ? d : { user: null, setup: false }))
      .catch(() => setSt({ user: null, setup: false }));
  }, []);
  useEffect(load, [load]);
  if (!st) return <div className="gate"><div className="spin" /></div>;
  if (!st.user) return <Gate setup={st.setup} onDone={(user) => setSt({ user, setup: false })} />;
  return <Reader user={st.user} onLock={() => setSt({ user: null, setup: false })} />;
}
