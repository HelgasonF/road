"use client";

import { useActionState } from "react";
import { openDriverAssignmentAccessAction } from "./assignment-access-actions";

export function DriverAssignmentAccessForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(openDriverAssignmentAccessAction, {});
  return <form action={action} className="login-form">
    <input name="assignmentToken" type="hidden" value={token} />
    <p className="login-intro">Opnaðu verkefnið þitt. Þú getur notað þennan tengil aftur meðan verkefnið er í gangi.</p>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    <button className="primary-button login-button" type="submit" disabled={pending}>{pending ? "Opna…" : "Opna ökumannsskjá"}</button>
  </form>;
}
