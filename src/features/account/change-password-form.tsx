"use client";

import { KeyRound } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";

import { changeOwnPasswordAction } from "./actions";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setResult(null);
    startTransition(async () => {
      const response = await changeOwnPasswordAction({
        currentPassword: String(values.get("currentPassword") ?? ""),
        newPassword: String(values.get("newPassword") ?? ""),
        confirmPassword: String(values.get("confirmPassword") ?? ""),
      });
      if (!response.ok) {
        const fieldMessage = Object.values(response.fieldErrors ?? {}).flat()[0];
        setResult({ ok: false, message: fieldMessage ?? response.error ?? "Ekki tókst að breyta lykilorðinu." });
        return;
      }
      form.reset();
      setResult({ ok: true, message: "Lykilorðinu hefur verið breytt." });
    });
  }

  return (
    <section className="account-card" aria-labelledby="change-password-title">
      <div className="account-card-heading"><KeyRound size={18} /><h2 id="change-password-title">Breyta lykilorði</h2></div>
      <p className="account-help">Minnst 10 stafir, bæði bókstafir og tölustafir.</p>
      <form className="account-form" onSubmit={submit}>
        <label className="field"><span>Núverandi lykilorð</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label className="field"><span>Nýtt lykilorð</span><input name="newPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
        <label className="field"><span>Endurtaka nýtt lykilorð</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Vista…" : "Vista nýtt lykilorð"}</button>
      </form>
      {result ? <p className={result.ok ? "account-success" : "compact-error"} role={result.ok ? "status" : "alert"}>{result.message}</p> : null}
    </section>
  );
}
