"use client";

import { useActionState } from "react";

import { setPasswordAction } from "./actions";

export function PasswordSetupForm() {
  const [state, action, pending] = useActionState(setPasswordAction, {});

  return (
    <form action={action} className="login-form">
      <label className="field">
        <span>Nýtt lykilorð</span>
        <input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label className="field">
        <span>Endurtaktu lykilorðið</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <p className="password-help">Notaðu að minnsta kosti 10 stafi, bókstaf og tölu.</p>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Vista…" : "Vista lykilorð"}</button>
    </form>
  );
}
