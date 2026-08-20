"use client";

import {
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserRoundPlus,
} from "lucide-react";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { DriverAccessStatus, Operator } from "@/lib/domain/types";
import {
  sendDriverInvitationAction,
  sendDriverPasswordResetAction,
  setDriverAccessDisabledAction,
} from "./actions";

const accessStatusLabels: Record<DriverAccessStatus, string> = {
  invited: "Boð sent",
  active: "Virkur aðgangur",
  disabled: "Aðgangi lokað",
};

interface DriverAccessPanelProps {
  demoMode: boolean;
  operator: Operator;
}

export function DriverAccessPanel({ demoMode, operator }: DriverAccessPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string; data?: { message: string } }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Aðgerðin mistókst.");
        return;
      }
      setConfirmDisable(false);
      setMessage(result.data?.message ?? "Aðgangur var uppfærður.");
      router.refresh();
    });
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => sendDriverInvitationAction({
      operatorId: operator.id,
      email: String(formData.get("driverEmail") ?? ""),
    }));
  }

  const access = operator.driverAccess;

  return (
    <section className="detail-section driver-access-section" aria-labelledby="driver-access-heading">
      <div className="section-heading">
        <div>
          <h3 id="driver-access-heading">Ökumannsaðgangur</h3>
          <p>Innskráning í ökumannsskjá Vegstoðar</p>
        </div>
        {access ? (
          <span className={`driver-access-status driver-access-status-${access.status}`}>
            {access.status === "disabled" ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
            {accessStatusLabels[access.status]}
          </span>
        ) : null}
      </div>

      {!access ? (
        <form className="driver-invite-form" onSubmit={invite}>
          <label className="field">
            <span>Netfang ökumanns</span>
            <div className="driver-email-input"><Mail size={16} /><input name="driverEmail" type="email" autoComplete="email" placeholder="okumadur@example.is" required /></div>
          </label>
          <p>Viðkomandi fær öruggan hlekk til að velja lykilorð. Þjónustuaðilinn, ökutækin og búnaðurinn haldast óbreytt.</p>
          <button className="small-action driver-access-primary" type="submit" disabled={demoMode || pending}>
            <UserRoundPlus size={15} /> {pending ? "Sendi…" : "Senda aðgangsboð"}
          </button>
        </form>
      ) : (
        <div className="driver-access-details">
          <div className="info-row">
            <Mail size={18} />
            <div><strong>{access.email}</strong><span>{access.status === "invited" ? "Bíður eftir að lykilorð sé valið" : "Tengt þessum þjónustuaðila"}</span></div>
          </div>

          <div className="driver-access-actions">
            {access.status === "invited" ? (
              <button className="small-action" type="button" disabled={demoMode || pending} onClick={() => run(() => sendDriverInvitationAction({ operatorId: operator.id, email: access.email }))}>
                <RefreshCw size={14} /> Senda boð aftur
              </button>
            ) : null}
            {access.status === "active" ? (
              <button className="small-action" type="button" disabled={demoMode || pending} onClick={() => run(() => sendDriverPasswordResetAction({ operatorId: operator.id }))}>
                <KeyRound size={14} /> Endurstilla lykilorð
              </button>
            ) : null}
            {access.status === "disabled" ? (
              <button className="small-action driver-access-primary" type="button" disabled={demoMode || pending} onClick={() => run(() => setDriverAccessDisabledAction({ operatorId: operator.id, disabled: false }))}>
                <ShieldCheck size={14} /> Virkja aðgang
              </button>
            ) : !confirmDisable ? (
              <button className="small-action driver-access-danger" type="button" disabled={demoMode || pending} onClick={() => setConfirmDisable(true)}>
                <ShieldOff size={14} /> Loka aðgangi
              </button>
            ) : null}
          </div>

          {confirmDisable ? (
            <div className="driver-access-confirm" role="alert">
              <p>Ökumaðurinn missir strax aðgang að verkefnum. Engum gögnum verður eytt.</p>
              <div><button className="danger-button" type="button" disabled={pending} onClick={() => run(() => setDriverAccessDisabledAction({ operatorId: operator.id, disabled: true }))}>Staðfesta lokun</button><button className="text-button" type="button" disabled={pending} onClick={() => setConfirmDisable(false)}>Hætta við</button></div>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="compact-error" role="alert">{error}</p> : null}
      {message ? <p className="compact-success" role="status">{message}</p> : null}
    </section>
  );
}
