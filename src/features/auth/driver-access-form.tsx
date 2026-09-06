"use client";

import { useActionState } from "react";

import { openDriverAccessAction } from "./actions";
import type { DriverAccessTokenType } from "@/features/operators/driver-access";

export function DriverAccessForm({ tokenHash, type }: { tokenHash: string; type: DriverAccessTokenType }) {
  const [state, action, pending] = useActionState(openDriverAccessAction, {});

  return (
    <form action={action} className="login-form">
      <input name="tokenHash" type="hidden" value={tokenHash} />
      <input name="type" type="hidden" value={type} />
      <p className="login-intro">Ýttu á hnappinn til að opna öruggan ökumannsskjá Vegstoðar.</p>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="primary-button login-button" type="submit" disabled={pending}>
        {pending ? "Opna…" : "Opna ökumannsskjá"}
      </button>
    </form>
  );
}
