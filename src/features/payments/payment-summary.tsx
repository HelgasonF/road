"use client";

import { CreditCard, LockKeyhole } from "lucide-react";
import { useState, useTransition } from "react";
import { resumeCustomerCheckoutAction } from "./checkout-actions";
import type { PublicPaymentSummary } from "./public-summary";

const copy = {
  en: {
    title: "Service payment", initial: "Initial assistance fee", amount: "Amount to pay", vehicle: "Vehicle",
    separate: "This is the service payment, separate from the initial assistance fee.",
    initialHelp: "Your details are saved. After payment is confirmed, your request will be submitted automatically. You do not need to return to this page.",
    pay: "Pay securely with myPOS", paid: "Payment received", pending: "Awaiting payment confirmation",
    submitted: "Your details have been submitted to dispatch.", review: "Payment received. Dispatch is reviewing your request.",
    unavailable: "This payment needs checking. Please contact Iceland Road Assistance dispatch.",
    secure: "Card details are entered securely on myPOS.", refresh: "Refresh payment status",
    retry: "Try payment again", retryHelp: "Payment setup failed. Your details are saved; you can try again without entering them again.",
    preparing: "Preparing payment…", retryError: "Payment could not be prepared. Please contact dispatch.",
  },
  is: {
    title: "Greiðsla fyrir þjónustu", initial: "Upphafsgjald fyrir aðstoð", amount: "Upphæð til greiðslu", vehicle: "Ökutæki",
    separate: "Þetta er greiðsla fyrir þjónustuna, aðskilin frá upphafsgjaldinu.",
    initialHelp: "Upplýsingarnar þínar eru vistaðar. Beiðnin verður send sjálfkrafa þegar greiðsla hefur verið staðfest. Þú þarft ekki að fara aftur á þessa síðu.",
    pay: "Greiða örugglega hjá myPOS", paid: "Greiðsla móttekin", pending: "Bíður staðfestingar á greiðslu",
    submitted: "Upplýsingarnar þínar hafa verið sendar til aðgerðastjórnar.", review: "Greiðsla móttekin. Aðgerðastjórn er að fara yfir beiðnina.",
    unavailable: "Skoða þarf stöðu greiðslunnar. Hafðu samband við aðgerðastjórn Iceland Road Assistance.",
    secure: "Kortaupplýsingar eru færðar inn á öruggri greiðslusíðu myPOS.", refresh: "Uppfæra greiðslustöðu",
    retry: "Reyna greiðslu aftur", retryHelp: "Ekki tókst að undirbúa greiðsluna. Upplýsingarnar þínar eru vistaðar og þú getur reynt aftur án þess að fylla þær út á ný.",
    preparing: "Undirbý greiðslu…", retryError: "Ekki tókst að undirbúa greiðslu. Hafðu samband við aðgerðastjórn.",
  },
};

export function PaymentSummary({ summary, initialToken }: { summary: PublicPaymentSummary; initialToken?: string }) {
  const [language, setLanguage] = useState<"en" | "is">("en");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = copy[language];
  const paid = summary.status === "paid";
  function retry() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await resumeCustomerCheckoutAction({ token: initialToken, language });
        if (result.ok) window.location.assign(result.data.checkoutUrl);
        else setError(result.error);
      } catch { setError(t.retryError); }
    });
  }
  return (
    <main className="customer-intake-page payment-summary-page" lang={language}>
      <div className="customer-intake-brand"><span aria-hidden="true">IR</span><strong>Iceland Road Assistance</strong></div>
      <div className="payment-language-switch" aria-label="Language"><button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button><button type="button" aria-pressed={language === "is"} onClick={() => setLanguage("is")}>Íslenska</button></div>
      <section className="customer-form-card payment-summary-card">
        <span className="payment-summary-icon"><CreditCard size={26} /></span>
        <h1>{summary.purpose === "initial_fee" ? t.initial : t.title}</h1>
        {summary.description ? <p className="payment-description">{summary.description}</p> : null}
        {summary.vehicleRegistration ? <p>{t.vehicle}: <strong>{summary.vehicleRegistration}</strong></p> : null}
        <div className="payment-summary-amount"><span>{t.amount}</span><strong>{new Intl.NumberFormat(language === "is" ? "is-IS" : "en-GB").format(summary.amountIsk)} ISK</strong></div>
        <p>{summary.purpose === "initial_fee" ? t.initialHelp : t.separate}</p>
        {paid ? (
          <div className="payment-confirmed" role="status"><strong>✓ {t.paid}</strong>{summary.intakeState ? <p>{summary.intakeState === "submitted" ? t.submitted : summary.intakeState === "review_required" ? t.review : t.pending}</p> : null}</div>
        ) : summary.checkoutUrl ? (
          <a className="customer-submit-button payment-pay-button" href={summary.checkoutUrl} rel="noreferrer"><LockKeyhole size={18} />{t.pay}</a>
        ) : summary.retryAllowed && initialToken ? <>
          <p role="status">{t.retryHelp}</p>
          <button type="button" className="customer-submit-button payment-pay-button" disabled={pending} onClick={retry}>{pending ? t.preparing : t.retry}</button>
        </> : <p className="customer-form-error" role="status">{t.unavailable}</p>}
        {error ? <p className="customer-form-error" role="alert">{error}</p> : null}
        {!paid && summary.checkoutUrl ? <small><LockKeyhole size={13} /> {t.secure}</small> : null}
        <button type="button" className="payment-refresh-button" onClick={() => window.location.reload()}>{t.refresh}</button>
      </section>
    </main>
  );
}
