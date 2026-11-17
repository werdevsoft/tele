"use client";
import { useState } from "react";
import { Account, api } from "@/lib/client";

type Step = "phone" | "code" | "password";

export default function LoginCard({ acc, onSignedIn, onEdit }: { acc: Account; onSignedIn: () => void; onEdit: () => void }) {
  const [step, setStep] = useState<Step>("phone");
  const [val, setVal] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const copy = {
    phone: ["Sign in to " + acc.label, "Enter the phone number of the Telegram account, with country code."],
    code: ["Enter the code", "Telegram sent a login code to your other signed-in app (or by SMS)."],
    password: ["Two-step password", "This account has a cloud password set."],
  }[step];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (step === "phone") { await api(`/accounts/${acc.id}/send-code`, "POST", { phone: val }); setStep("code"); setVal(""); }
      else {
        const r = await api(`/accounts/${acc.id}/sign-in`, "POST", step === "code" ? { code: val } : { password: val });
        if (r.needs_password) { setStep("password"); setVal(""); } else onSignedIn();
      }
    } catch (ex: any) { setErr(ex.message); }
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="card" onSubmit={submit} key={step}>
        <h2>{copy[0]}</h2><p>{copy[1]}</p>
        <label className="field"><span>{{ phone: "Phone number", code: "Login code", password: "Password" }[step]}</span>
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
            className={step === "code" ? "code" : ""} type={step === "password" ? "password" : step === "phone" ? "tel" : "text"}
            inputMode={step === "code" ? "numeric" : undefined} maxLength={step === "code" ? 8 : undefined}
            placeholder={step === "phone" ? "+62 812 3456 7890" : ""} autoComplete={step === "code" ? "one-time-code" : undefined} /></label>
        <div className="err">{err}</div>
        <div className="row">
          {step !== "phone" && <button type="button" className="btn" onClick={() => { setStep("phone"); setVal(""); setErr(""); }}>Back</button>}
          <button className="btn primary" disabled={busy || !val}>{step === "phone" ? "Send code" : "Continue"}</button>
        </div>
        <p className="hint">Using api_id {acc.api_id}. <a href="#" onClick={(e) => { e.preventDefault(); onEdit(); }}>Change credentials</a></p>
      </form>
    </div>
  );
}
