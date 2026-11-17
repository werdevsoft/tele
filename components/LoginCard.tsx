"use client";
import { useState } from "react";
import { Account, api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

type Step = "phone" | "code" | "password";

export default function LoginCard({ acc, onSignedIn, onEdit }: { acc: Account; onSignedIn: () => void; onEdit: () => void }) {
  const { t, tr } = useI18n();
  const toast = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [val, setVal] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const copy = {
    phone: [t("login.title", { label: acc.label }), t("login.phoneIntro")],
    code: [t("login.codeTitle"), t("login.codeIntro")],
    password: [t("login.pwTitle"), t("login.pwIntro")],
  }[step];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (step === "phone") { await api(`/accounts/${acc.id}/send-code`, "POST", { phone: val }); setStep("code"); setVal(""); }
      else {
        const r = await api(`/accounts/${acc.id}/sign-in`, "POST", step === "code" ? { code: val } : { password: val });
        if (r.needs_password) { setStep("password"); setVal(""); } else { toast(t("login.done", { label: acc.label })); onSignedIn(); }
      }
    } catch (ex: any) { setErr(tr(ex.message)); }
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="card" onSubmit={submit} key={step}>
        <h2>{copy[0]}</h2><p>{copy[1]}</p>
        <label className="field"><span>{{ phone: t("login.phone"), code: t("login.code"), password: t("field.password") }[step]}</span>
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
            className={step === "code" ? "code" : ""} type={step === "password" ? "password" : step === "phone" ? "tel" : "text"}
            inputMode={step === "code" ? "numeric" : undefined} maxLength={step === "code" ? 8 : undefined}
            placeholder={step === "phone" ? "+62 812 3456 7890" : ""} autoComplete={step === "code" ? "one-time-code" : undefined} /></label>
        <div className="err">{err}</div>
        <div className="row">
          {step !== "phone" && <button type="button" className="btn" onClick={() => { setStep("phone"); setVal(""); setErr(""); }}>{t("btn.back")}</button>}
          <button className="btn primary" disabled={busy || !val}>{step === "phone" ? t("login.sendCode") : t("btn.continue")}</button>
        </div>
        <p className="hint">{t("login.using", { id: acc.api_id })} <a href="#" onClick={(e) => { e.preventDefault(); onEdit(); }}>{t("login.change")}</a></p>
      </form>
    </div>
  );
}
