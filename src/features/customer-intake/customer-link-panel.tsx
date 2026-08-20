"use client";

import { Check, Copy, Link2, LockKeyhole, RefreshCw, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createCustomerIntakeLinkAction,
  revokeCustomerIntakeLinkAction,
} from "./actions";
import type { CustomerIntakeLinkSummary } from "./queries";

interface CustomerLinkPanelProps {
  jobId: string;
  link: CustomerIntakeLinkSummary | null;
}

export function CustomerLinkPanel({ jobId, link }: CustomerLinkPanelProps) {
  const router = useRouter();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createLink() {
    setError(null);
    setCopied(false);
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

  async function copyLink() {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
    } catch {
      setError("Ekki tókst að afrita tengilinn. Veldu hann og afritaðu handvirkt.");
    }
  }

  const active = link?.status === "active";
  const submitted = link?.status === "submitted";

  return (
    <section className="detail-section customer-link-panel">
      <div className="customer-link-heading"><div><h3>Öruggur viðskiptavinatengill</h3><p>Staðsetning, ökutæki og einkamyndir án innskráningar.</p></div><LockKeyhole size={19} /></div>

      {submitted ? <p className="customer-link-status status-submitted"><Check size={15} /> Upplýsingar mótteknar</p> : null}
      {active ? <p className="customer-link-status status-active"><Link2 size={15} /> Virkur til {new Date(link.expiresAt).toLocaleString("is-IS", { dateStyle: "short", timeStyle: "short" })}</p> : null}
      {link && !active && !submitted ? <p className="customer-link-status">Tengill er útrunninn eða hefur verið afturkallaður.</p> : null}

      {generatedUrl ? (
        <div className="customer-generated-link">
          <input aria-label="Viðskiptavinatengill" value={generatedUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
          <button className="secondary-button" type="button" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Afritað" : "Afrita"}</button>
        </div>
      ) : active ? <p className="muted-copy">Vegna öryggis er hrái tengillinn aðeins sýndur þegar hann er búinn til. Búðu til nýjan ef afrita þarf hann aftur.</p> : null}

      <div className="customer-link-actions">
        <button className="secondary-button" type="button" disabled={pending} onClick={createLink}>{active || submitted ? <RefreshCw size={15} /> : <Link2 size={15} />}{pending ? "Vinn…" : active ? "Nýr tengill" : submitted ? "Óska eftir leiðréttingu" : "Búa til tengil"}</button>
        {active ? <button className="text-danger-button" type="button" disabled={pending} onClick={revokeLink}><Unlink size={15} /> Afturkalla</button> : null}
      </div>
      {active && !generatedUrl ? <small>Nýr tengill afturkallar sjálfkrafa þann gamla.</small> : null}
      {error ? <p className="compact-error" role="alert">{error}</p> : null}
    </section>
  );
}
