"use client";

import { Check, Link2, LockKeyhole, RefreshCw, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ManualWhatsAppMessage } from "@/features/whatsapp/manual-message";
import {
  createCustomerIntakeLinkAction,
  revokeCustomerIntakeLinkAction,
} from "./actions";
import { buildCustomerIntakeWhatsAppMessage } from "./customer-contact";
import { formatCustomerLinkExpiry } from "./format";
import type { CustomerIntakeLinkSummary } from "./queries";

interface CustomerLinkPanelProps {
  customerName: string;
  customerPhone: string;
  jobId: string;
  link: CustomerIntakeLinkSummary | null;
}

export function CustomerLinkPanel({ customerName, customerPhone, jobId, link }: CustomerLinkPanelProps) {
  const router = useRouter();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createLink() {
    setError(null);
    startTransition(async () => {
      const result = await createCustomerIntakeLinkAction({ jobId });
      if (!result.ok || !result.data) {
        setError(result.error ?? "Ekki tókst að búa til tengil.");
        return;
      }
      setGeneratedUrl(new URL(result.data.path, window.location.origin).toString());
      router.refresh();
    });
  }

  function revokeLink() {
    if (!link) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeCustomerIntakeLinkAction({ linkId: link.id });
      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að afturkalla tengilinn.");
        return;
      }
      setGeneratedUrl(null);
      router.refresh();
    });
  }

  const active = link?.status === "active";
  const submitted = link?.status === "submitted";
  const customerMessage = generatedUrl
    ? buildCustomerIntakeWhatsAppMessage(customerName, generatedUrl)
    : null;

  return (
    <section className="detail-section customer-link-panel">
      <div className="customer-link-heading"><div><h3>Öruggur viðskiptavinatengill</h3><p>Staðsetning, ökutæki og einkamyndir án innskráningar.</p></div><LockKeyhole size={19} /></div>

      {submitted ? <p className="customer-link-status status-submitted"><Check size={15} /> Upplýsingar mótteknar</p> : null}
      {active ? <p className="customer-link-status status-active"><Link2 size={15} /> Virkur til {formatCustomerLinkExpiry(link.expiresAt, "is")}</p> : null}
      {link && !active && !submitted ? <p className="customer-link-status">Tengill er útrunninn eða hefur verið afturkallaður.</p> : null}

      {customerMessage ? (
        <div className="customer-whatsapp-handoff">
          <ManualWhatsAppMessage key={customerMessage} message={customerMessage} phone={customerPhone} recipientName={customerName || customerPhone} />
        </div>
      ) : active ? <p className="muted-copy">Vegna öryggis er hrái tengillinn aðeins tiltækur þegar hann er búinn til. Búðu til nýjan til að senda aftur í WhatsApp.</p> : null}

      <div className="customer-link-actions">
        <button className="secondary-button" type="button" disabled={pending} onClick={createLink}>{active || submitted ? <RefreshCw size={15} /> : <Link2 size={15} />}{pending ? "Bý til…" : active ? "Nýr tengill" : submitted ? "Óska eftir leiðréttingu" : "Búa til tengil"}</button>
        {active ? <button className="text-danger-button" type="button" disabled={pending} onClick={revokeLink}><Unlink size={15} /> Afturkalla</button> : null}
      </div>
      {active && !generatedUrl ? <small>Nýr tengill afturkallar sjálfkrafa þann gamla.</small> : null}
      {error ? <p className="compact-error" role="alert">{error}</p> : null}
    </section>
  );
}
