"use client";

import {
  Link2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { buildContactLinks, buildWhatsAppHref } from "@/lib/contact-links";
import type { DriverAccessStatus, Operator } from "@/lib/domain/types";
import {
  createDriverAccessLinkAction,
  setDriverAccessDisabledAction,
} from "./actions";
import { buildDriverAccessWhatsAppMessage } from "./driver-access";

const accessStatusLabels: Record<DriverAccessStatus, string> = {
  pending: "Tengill búinn til",
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
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const access = operator.driverAccess;
  const { whatsappHref } = buildContactLinks(operator.phone);
  const accessWhatsAppHref = generatedUrl
    ? buildWhatsAppHref(
      operator.phone,
      buildDriverAccessWhatsAppMessage(operator.name, generatedUrl),
    )
    : null;

  function createLink() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createDriverAccessLinkAction({ operatorId: operator.id });
      if (!result.ok || !result.data) {
        setError(result.error ?? "Ekki tókst að búa til ökumannstengil.");
        return;
      }
      setGeneratedUrl(new URL(result.data.path, window.location.origin).toString());
      setMessage("Öruggi tengillinn er tilbúinn fyrir WhatsApp.");
      router.refresh();
    });
  }

  function toggleAccess(disabled: boolean) {
    setError(null);
    setMessage(null);
    setGeneratedUrl(null);
    startTransition(async () => {
      const result = await setDriverAccessDisabledAction({ operatorId: operator.id, disabled });
      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að breyta ökumannsaðganginum.");
        return;
      }
      setConfirmDisable(false);
      setMessage(result.data?.message ?? "Aðgangur var uppfærður.");
      router.refresh();
    });
  }

  return (
    <section className="detail-section driver-access-section" aria-labelledby="driver-access-heading">
      <div className="section-heading">
        <div>
          <h3 id="driver-access-heading">Ökumannsaðgangur</h3>
          <p>Öruggur innskráningartengill sendur í WhatsApp</p>
        </div>
        {access ? (
          <span className={`driver-access-status driver-access-status-${access.status}`}>
            {access.status === "disabled" ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
            {accessStatusLabels[access.status]}
          </span>
        ) : null}
      </div>

      <div className="driver-access-details">
        <div className="info-row">
          <MessageCircle size={18} />
          <div>
            <strong>{operator.phone}</strong>
            <span>
              {!access
                ? "Enginn ökumannsaðgangur hefur verið stofnaður"
                : access.status === "pending"
                  ? "Bíður eftir að ökumaður opni WhatsApp-tengil"
                  : access.status === "active"
                    ? "Tengt þessum þjónustuaðila"
                    : "Aðgangurinn er lokaður"}
            </span>
          </div>
        </div>

        <div className="driver-access-actions">
          {access?.status !== "disabled" && whatsappHref ? (
            <button
              className="small-action driver-access-primary"
              type="button"
              disabled={demoMode || pending}
              onClick={createLink}
            >
              {access ? <RefreshCw size={14} /> : <Link2 size={14} />}
              {pending ? "Bý til…" : access ? "Nýr aðgangstengill" : "Búa til aðgangstengil"}
            </button>
          ) : null}
          {access?.status === "disabled" ? (
            <button className="small-action driver-access-primary" type="button" disabled={demoMode || pending} onClick={() => toggleAccess(false)}>
              <ShieldCheck size={14} /> Virkja aðgang
            </button>
          ) : access && !confirmDisable ? (
            <button className="small-action driver-access-danger" type="button" disabled={demoMode || pending} onClick={() => setConfirmDisable(true)}>
              <ShieldOff size={14} /> Loka aðgangi
            </button>
          ) : null}
        </div>

        {accessWhatsAppHref ? (
          <div className="driver-whatsapp-handoff">
            <p>Farðu yfir skilaboðin og ýttu sjálf/ur á Senda í WhatsApp.</p>
            <a
              className="customer-whatsapp-send"
              href={accessWhatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Senda ökumannsaðgang til ${operator.name} í WhatsApp`}
            >
              <MessageCircle size={16} /> Senda í WhatsApp
            </a>
          </div>
        ) : null}
      </div>

      {confirmDisable ? (
        <div className="driver-access-confirm" role="alert">
          <p>Ökumaðurinn missir strax aðgang að verkefnum. Engum gögnum verður eytt.</p>
          <div>
            <button className="danger-button" type="button" disabled={pending} onClick={() => toggleAccess(true)}>Staðfesta lokun</button>
            <button className="text-button" type="button" disabled={pending} onClick={() => setConfirmDisable(false)}>Hætta við</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="compact-error" role="alert">{error}</p> : null}
      {message ? <p className="compact-success" role="status">{message}</p> : null}
    </section>
  );
}
