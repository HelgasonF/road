"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";

import { is } from "@/lib/i18n/is";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="login-form">
      <label className="field">
        <span>{is.email}</span>
        <span className="input-with-icon">
          <Mail aria-hidden="true" size={18} />
          <input name="email" type="email" autoComplete="email" required />
        </span>
      </label>

      <label className="field">
        <span>{is.password}</span>
        <span className="input-with-icon">
          <LockKeyhole aria-hidden="true" size={18} />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </span>
      </label>

      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}

      <button className="primary-button login-button" type="submit" disabled={pending}>
        {pending ? is.signingIn : is.signIn}
      </button>
    </form>
  );
}
