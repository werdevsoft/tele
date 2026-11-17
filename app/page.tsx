"use client";
import { useEffect, useState } from "react";
import Reader from "@/components/Reader";
import Gate from "@/components/Gate";

export default function Page() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/auth/me").then((r) => setAuthed(r.ok)).catch(() => setAuthed(false)); }, []);
  if (authed === null) return <div className="gate"><div className="spin" /></div>;
  if (!authed) return <Gate onDone={() => setAuthed(true)} />;
  return <Reader onLock={() => setAuthed(false)} />;
}
