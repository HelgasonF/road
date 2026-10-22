"use client";

import { CreditCard, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { ManualWhatsAppMessage } from "@/features/whatsapp/manual-message";
import { verifyJobPaymentRequestAction } from "./actions";
import { createServicePaymentLinkAction, getPaymentPanelAction } from "./checkout-actions";
import type { PaymentRequest, PaymentStatus } from "./types";

const labels: Record<PaymentStatus, string> = {
  creating: "Í undirbúningi", creation_unknown: "Þarf yfirferð", creation_failed: "Undirbúningur mistókst",
  pending: "Bíður greiðslu", seen: "Tengill opnaður", paid: "Greitt", failed: "Greiðslutilraun mistókst",
  expired: "Útrunnið", cancelled: "Afturkallað", unknown: "Óþekkt staða",
};
const money = (amount: number) => `${new Intl.NumberFormat("is-IS").format(amount)} ISK`;
const awaitingStatus = new Set<PaymentStatus>(["pending", "seen", "failed", "unknown"]);

export function PaymentPanel({ jobId, customerName, customerPhone, intakePending }: { jobId: string; customerName: string; customerPhone: string; intakePending: boolean }) {
  const [state, setState] = useState<{ enabled: boolean; ready: boolean; environment: "sandbox" | "production" | null; serviceDescription: string | null; intakeReviewRequired: boolean; requests: PaymentRequest[] } | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusRefreshFailed, setStatusRefreshFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const watching = Boolean(state?.enabled && (intakePending || state.requests.some((request) =>
    request.environment === state.environment && request.providerCode && awaitingStatus.has(request.status))));

  useEffect(() => {
    let active = true;
    void getPaymentPanelAction({ jobId }).then((result) => {
      if (!active) return;
      if (result.ok) setState(result.data);
      else setError("Ekki tókst að sækja greiðslustöðu.");
    }).catch(() => { if (active) setError("Ekki tókst að sækja greiðslustöðu."); });
    return () => { active = false; };
  }, [jobId, intakePending]);

  useEffect(() => {
    if (!watching || pending) return;
    let active = true;
    let inFlight = false;
    async function readLatestStatus() {
      if (!active || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        // Only read the worker's verified database state. UI polling never
        // creates payments or adds direct calls to the payment provider.
        const result = await getPaymentPanelAction({ jobId });
        if (!active) return;
        if (result.ok) { setState(result.data); setStatusRefreshFailed(false); }
        else setStatusRefreshFailed(true);
      } catch {
        if (active) setStatusRefreshFailed(true);
      } finally { inFlight = false; }
    }
    const timer = window.setInterval(() => { void readLatestStatus(); }, 15_000);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void readLatestStatus(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [jobId, watching, pending]);

  const second = state?.requests.find((request) => request.purpose === "service" && request.environment === state.environment);
  const first = state?.requests.find((request) => request.purpose === "initial_fee" && request.environment === state.environment);
  const locked = Boolean(second);

  async function refresh() {
    const result = await getPaymentPanelAction({ jobId });
    if (result.ok) { setState(result.data); setStatusRefreshFailed(false); }
    else setError("Ekki tókst að sækja greiðslustöðu.");
  }

  function createLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const amountIsk = second?.amountIsk ?? Number(amount);
        const paymentDescription = state?.serviceDescription ?? description;
        const result = await createServicePaymentLinkAction({ jobId, amountIsk, description: paymentDescription });
        if (!result.ok) {
          const errors: Record<string, string> = {
            payment_details_locked: "Upphæð og lýsing eru læstar við tilbúna greiðslubeiðni. Notaðu sömu upplýsingar eða fáðu aðstoð við yfirferð.",
            payment_amount_locked: "Ekki er hægt að breyta upphæð tilbúinnar greiðslubeiðni.",
            payment_creation_unresolved: "Óvíst er hvort beiðni var búin til. Skoða þarf stöðuna áður en reynt er aftur.",
            payment_persistence_uncertain: "Óvíst er hvort beiðni var vistuð. Skoða þarf stöðuna áður en reynt er aftur.",
          };
          setError(errors[result.errorCode] ?? "Ekki tókst að búa til greiðslutengil. Athugaðu stillingar og greiðslustöðu.");
        } else {
          const url = new URL(result.data.path, window.location.origin).toString();
          const customerAmount = `${new Intl.NumberFormat("en-GB").format(amountIsk)} ISK`;
          setMessage(`Hello ${customerName.replace(/\s+/g, " ").trim()},\n\nIceland Road Assistance — service payment\n${paymentDescription.trim()}\nAmount: ${customerAmount}\n\nThis payment is separate from the initial assistance fee. Review the details and pay securely here:\n${url}\n\nThis private link is valid for 24 hours. Do not forward it.`);
        }
        await refresh();
      } catch {
        setError("Óvíst er hvort tengillinn var tilbúinn. Uppfærðu greiðslustöðuna áður en þú reynir aftur.");
      }
    });
  }

  function verify(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await verifyJobPaymentRequestAction({ paymentId: id });
        if (!result.ok) setError("Ekki tókst að staðfesta greiðslustöðu hjá myPOS.");
        await refresh();
      } catch { setError("Ekki tókst að staðfesta greiðslustöðu hjá myPOS."); }
    });
  }

  return <section className="detail-section payment-panel">
    <div className="customer-link-heading"><div><h3>Greiðslur viðskiptavinar</h3><p>Upphafsgjald og aðskilin greiðsla fyrir þjónustu.</p></div><CreditCard size={19} /></div>
    {!state ? <p role={error ? "alert" : "status"}>{error ?? "Sæki greiðslustöðu…"}</p>
      : !state.enabled ? <p className="muted-copy">Greiðslukerfið er í undirbúningi og er ekki virkt.</p>
        : <>
          {!state.ready ? <p className="compact-error">Greiðslusending er ekki virk. Ljúka þarf stillingum áður en hægt er að búa til tengla.</p> : null}
          <div className="payment-history" aria-live="polite">{state.requests.map((request) => <div className="payment-history-row" key={request.id}><span><strong>{request.purpose === "initial_fee" ? "Upphafsgjald" : "Þjónusta"}</strong><small>{money(request.amountIsk)} · {labels[request.status]}{request.environment === "sandbox" ? " · Prófun" : ""}</small></span>{request.providerCode && request.status !== "paid" ? <button type="button" className="icon-button" disabled={pending || !state.ready} onClick={() => verify(request.id)} aria-label={`Staðfesta ${request.purpose === "initial_fee" ? "upphafsgjald" : "þjónustugreiðslu"}`}><RefreshCw size={15} /></button> : null}</div>)}</div>
          {watching ? <p className="muted-copy">Greiðslustaða uppfærist sjálfkrafa.</p> : null}
          {statusRefreshFailed ? <p className="compact-error" role="status">Ekki tókst að uppfæra greiðslustöðu. Reyni aftur sjálfkrafa.</p> : null}
          {state.intakeReviewRequired ? <p className="compact-error" role="alert">Upphafsgjaldið er greitt en upplýsingarnar bíða yfirferðar hjá starfsfólki. Ekki senda nýja greiðslubeiðni.</p> : null}
          {intakePending ? <p className="muted-copy">{first?.status === "paid" ? "Upphafsgjaldið er greitt. Upplýsingarnar bíða staðfestingar." : "Viðskiptavinurinn fyllir út upplýsingarnar og greiðir upphafsgjaldið í formtenglinum."}</p> : second?.status === "paid" ? <p className="payment-confirmed" role="status">Þjónustugreiðsla hefur verið staðfest hjá myPOS.</p> : <form className="payment-service-form" onSubmit={createLink}>
            <label className="field"><span>Upphæð fyrir þjónustu (ISK)</span><input type="number" inputMode="numeric" min={1} max={2147483647} step={1} required value={locked ? second!.amountIsk : amount} disabled={pending || locked} onChange={(event) => setAmount(event.target.value)} /></label>
            <label className="field"><span>Lýsing fyrir viðskiptavin</span><textarea value={state.serviceDescription ?? description} minLength={3} maxLength={500} required disabled={pending || locked} onChange={(event) => setDescription(event.target.value)} placeholder="Lýstu þjónustunni sem greiðslan nær yfir" /></label>
            {locked ? <small>Upphæð og lýsing eru læstar. Nýr síðutengill afturkallar þann gamla og notar sömu greiðslubeiðni.</small> : null}
            <button className="secondary-button full-button" type="submit" disabled={pending || !state.ready || ["expired", "cancelled", "creation_unknown", "creating", "creation_failed"].includes(second?.status ?? "")}>{pending ? "Undirbý…" : locked ? "Nýr tengill fyrir sömu greiðslu" : "Undirbúa seinni greiðslu"}</button>
          </form>}
          {message ? <ManualWhatsAppMessage key={message} message={message} phone={customerPhone} recipientName={customerName} /> : null}
          {error ? <p className="compact-error" role="alert">{error}</p> : null}
        </>}
  </section>;
}
