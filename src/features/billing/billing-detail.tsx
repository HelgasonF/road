"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Check,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  History,
  MapPin,
  Save,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";

import { billingPayerTypes } from "@/lib/domain/types";
import { jobStatusLabels } from "@/lib/i18n/is";
import { saveBillingDetailsAction, transitionBillingAction } from "./actions";
import {
  billingActionLabels,
  payableStatusLabels,
  payerTypeLabels,
  receivableStatusLabels,
} from "./labels";
import type { BillingTransitionInput } from "./schemas";
import type { JobBillingCase, JobBillingEvent } from "./types";
import { formatBillingDate, formatIsk, isPastDue } from "./workflow";

interface BillingDetailProps {
  billingCase: JobBillingCase | null;
  demoMode: boolean;
  events: JobBillingEvent[];
  onChanged: () => void;
}

function optionalAmount(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized === "" ? null : Number(normalized);
}

function timestamp(value: string) {
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  return `${formatBillingDate(date)} kl. ${time}`;
}

function TransitionForm({
  action,
  billingCase,
  buttonLabel,
  demoMode,
  onChanged,
  requireInvoice,
}: {
  action: BillingTransitionInput["action"];
  billingCase: JobBillingCase;
  buttonLabel: string;
  demoMode: boolean;
  onChanged: () => void;
  requireInvoice?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await transitionBillingAction({
        jobId: billingCase.jobId,
        action,
        reference: String(form.get("reference") ?? ""),
        dueDate: String(form.get("dueDate") ?? ""),
        notes: String(form.get("notes") ?? ""),
      });
      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að uppfæra stöðu.");
        return;
      }
      onChanged();
    });
  }

  return (
    <form className="billing-transition-form" onSubmit={submit}>
      {requireInvoice ? (
        <div className="billing-transition-fields">
          <label><span>Reikningsnúmer</span><input name="reference" required maxLength={120} /></label>
          <label><span>Gjalddagi</span><input name="dueDate" type="date" required /></label>
        </div>
      ) : null}
      {(action === "dispute_payer" || action === "dispute_provider") ? (
        <label><span>Ástæða ágreinings</span><textarea name="notes" required minLength={2} maxLength={2000} rows={2} /></label>
      ) : <input name="notes" type="hidden" value="" />}
      <button className="secondary-button full-button" type="submit" disabled={demoMode || pending}>
        {pending ? "Vista…" : buttonLabel}
      </button>
      {error ? <p className="compact-error" role="alert">{error}</p> : null}
    </form>
  );
}

function QuickTransitionButton({
  action,
  billingCase,
  children,
  demoMode,
  onChanged,
  tone = "primary",
}: {
  action: BillingTransitionInput["action"];
  billingCase: JobBillingCase;
  children: React.ReactNode;
  demoMode: boolean;
  onChanged: () => void;
  tone?: "primary" | "secondary" | "danger";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (action === "record_payer_payment" || action === "record_provider_payment") {
      if (!window.confirm("Staðfesta að greiðslan hafi raunverulega farið fram?")) return;
    }
    if (action === "refund_payer") {
      if (!window.confirm("Staðfesta að greiðsla hafi raunverulega verið endurgreidd?")) return;
    }
    if (action === "void_billing") {
      if (!window.confirm("Staðfesta að hvorki greiðandi né þjónustuaðili eigi að fá reikning vegna verkefnisins?")) return;
    }
    setError(null);
    startTransition(async () => {
      const result = await transitionBillingAction({
        jobId: billingCase.jobId,
        action,
        reference: null,
        dueDate: null,
        notes: null,
      });
      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að uppfæra stöðu.");
        return;
      }
      onChanged();
    });
  }

  return (
    <div className="billing-quick-action">
      <button className={`${tone}-button full-button`} type="button" disabled={demoMode || pending} onClick={run}>
        {pending ? "Vista…" : children}
      </button>
      {error ? <p className="compact-error" role="alert">{error}</p> : null}
    </div>
  );
}

function BillingDetailsForm({ billingCase, demoMode, onChanged }: Omit<BillingDetailProps, "billingCase" | "events"> & { billingCase: JobBillingCase }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const payerLocked = !["missing_information", "draft", "ready_to_invoice"].includes(billingCase.receivableStatus);
  const providerLocked = !["not_ready", "awaiting_provider_invoice"].includes(billingCase.payableStatus);
  const billingVoided = billingCase.receivableStatus === "void" && billingCase.payableStatus === "void";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveBillingDetailsAction({
        jobId: billingCase.jobId,
        payerType: payerLocked ? billingCase.payerType : String(form.get("payerType") ?? "") as JobBillingCase["payerType"] || null,
        payerName: payerLocked ? billingCase.payerName : String(form.get("payerName") ?? ""),
        payerKennitala: payerLocked ? billingCase.payerKennitala : String(form.get("payerKennitala") ?? ""),
        payerEmail: payerLocked ? billingCase.payerEmail ?? "" : String(form.get("payerEmail") ?? ""),
        payerPhone: payerLocked ? billingCase.payerPhone : String(form.get("payerPhone") ?? ""),
        payerAddress: payerLocked ? billingCase.payerAddress : String(form.get("payerAddress") ?? ""),
        authorizationReference: payerLocked ? billingCase.authorizationReference : String(form.get("authorizationReference") ?? ""),
        billingReference: payerLocked ? billingCase.billingReference : String(form.get("billingReference") ?? ""),
        serviceSummary: payerLocked ? billingCase.serviceSummary : String(form.get("serviceSummary") ?? ""),
        payerAmountIsk: payerLocked ? billingCase.payerAmountIsk : optionalAmount(form.get("payerAmountIsk")),
        providerAmountIsk: providerLocked ? billingCase.providerAmountIsk : optionalAmount(form.get("providerAmountIsk")),
        notes: String(form.get("notes") ?? ""),
      });

      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að vista uppgjörið.");
        return;
      }
      setSaved(true);
      onChanged();
    });
  }

  return (
    <form className="billing-details-form" onSubmit={submit}>
      <div className="billing-section-heading">
        <div><p className="eyebrow">Greiðandi → Vegstoð</p><h3>Greiðandaupplýsingar</h3></div>
        <BanknoteArrowDown size={21} />
      </div>

      <fieldset className="billing-form-grid billing-fieldset" disabled={demoMode || payerLocked}>
        <label className="field"><span>Tegund greiðanda</span><select name="payerType" defaultValue={billingCase.payerType ?? ""}><option value="">Veldu greiðanda</option>{billingPayerTypes.map((type) => <option key={type} value={type}>{payerTypeLabels[type]}</option>)}</select></label>
        <label className="field"><span>Nafn greiðanda</span><input name="payerName" defaultValue={billingCase.payerName ?? ""} maxLength={160} placeholder={billingCase.customerName} /></label>
        <label className="field"><span>Kennitala / auðkenni</span><input name="payerKennitala" defaultValue={billingCase.payerKennitala ?? ""} maxLength={32} /></label>
        <label className="field"><span>Netfang reikninga</span><input name="payerEmail" defaultValue={billingCase.payerEmail ?? ""} type="email" maxLength={254} /></label>
        <label className="field"><span>Sími greiðanda</span><input name="payerPhone" defaultValue={billingCase.payerPhone ?? ""} type="tel" maxLength={40} /></label>
        <label className="field billing-field-wide"><span>Heimilisfang</span><input name="payerAddress" defaultValue={billingCase.payerAddress ?? ""} maxLength={500} /></label>
        <label className="field"><span>Heimild / tjónsnúmer</span><input name="authorizationReference" defaultValue={billingCase.authorizationReference ?? ""} maxLength={120} /></label>
        <label className="field"><span>Tilvísun / innkaupanúmer</span><input name="billingReference" defaultValue={billingCase.billingReference ?? ""} maxLength={120} /></label>
        <label className="field billing-field-wide"><span>Unnin þjónusta</span><textarea name="serviceSummary" defaultValue={billingCase.serviceSummary ?? ""} maxLength={4000} rows={3} /></label>
      </fieldset>
      {payerLocked ? (
        <p className="billing-lock-note"><FileCheck2 size={14} /> {billingVoided
          ? "Uppgjörið er ógilt og fjárhagsupplýsingar þess eru læstar."
          : "Greiðandaupplýsingar og upphæð eru læst eftir útgáfu reiknings. Ekki yfirskrifa útgefinn reikning; skráðu leiðréttingu sem sérstakt reikningsferli."}</p>
      ) : null}

      <div className="billing-section-heading billing-provider-heading">
        <div><p className="eyebrow">Vegstoð → þjónustuaðili</p><h3>Uppgjör þjónustuaðila</h3></div>
        <BanknoteArrowUp size={21} />
      </div>
      <p className="billing-provider-name"><UserRound size={16} /> {billingCase.operatorName ?? "Enginn þjónustuaðili skráður"}</p>

      <div className="billing-amount-grid">
        <label className="field"><span>Greiðandi greiðir Vegstoð</span><div className="amount-input"><input name="payerAmountIsk" defaultValue={billingCase.payerAmountIsk ?? ""} disabled={demoMode || payerLocked} inputMode="numeric" min={0} step={1} type="number" /><b>kr.</b></div></label>
        <label className="field"><span>Vegstoð greiðir þjónustuaðila</span><div className="amount-input"><input name="providerAmountIsk" defaultValue={billingCase.providerAmountIsk ?? ""} disabled={demoMode || providerLocked} inputMode="numeric" min={0} step={1} type="number" /><b>kr.</b></div></label>
        <div className="billing-margin-preview"><span>Brúttómunur</span><strong>{billingCase.payerAmountIsk !== null && billingCase.providerAmountIsk !== null ? formatIsk(billingCase.payerAmountIsk - billingCase.providerAmountIsk) : "—"}</strong><small>Ekki bókhaldslegur hagnaður; upphæðir geta innihaldið VSK.</small></div>
      </div>

      <label className="field"><span>Innri athugasemdir</span><textarea name="notes" defaultValue={billingCase.notes ?? ""} maxLength={4000} rows={3} /></label>
      <div className="billing-form-actions">
        {saved ? <span className="billing-saved"><Check size={15} /> Vistað</span> : null}
        <button className="primary-button" type="submit" disabled={demoMode || pending}><Save size={16} /> {pending ? "Vista…" : "Vista uppgjör"}</button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}

function MoneyLegs({ billingCase, demoMode, onChanged }: Omit<BillingDetailProps, "billingCase" | "events"> & { billingCase: JobBillingCase }) {
  const payerPastDue = billingCase.receivableStatus === "invoiced" && isPastDue(billingCase.payerDueAt);
  const providerPastDue = billingCase.payableStatus === "approved" && isPastDue(billingCase.providerDueAt);

  return (
    <section className="billing-money-legs">
      <article className="billing-leg-card billing-leg-receivable">
        <header><span><BanknoteArrowDown size={19} /></span><div><small>Greiðandi → Vegstoð</small><strong>{receivableStatusLabels[billingCase.receivableStatus]}</strong></div></header>
        <div className="billing-leg-amount">{formatIsk(billingCase.payerAmountIsk)}</div>
        {billingCase.payerInvoiceNumber ? <dl><div><dt>Reikningur</dt><dd>{billingCase.payerInvoiceNumber}</dd></div><div><dt>Gjalddagi</dt><dd className={payerPastDue ? "billing-overdue" : ""}>{formatBillingDate(billingCase.payerDueAt)}</dd></div></dl> : null}
        {billingCase.receivableStatus === "ready_to_invoice" ? <TransitionForm action="issue_payer_invoice" billingCase={billingCase} buttonLabel="Skrá útgefinn reikning" demoMode={demoMode} onChanged={onChanged} requireInvoice /> : null}
        {(billingCase.receivableStatus === "invoiced" || billingCase.receivableStatus === "overdue") ? (
          <>
            <QuickTransitionButton action="record_payer_payment" billingCase={billingCase} demoMode={demoMode} onChanged={onChanged}><Check size={16} /> Skrá greiðslu móttekna</QuickTransitionButton>
            {payerPastDue && billingCase.receivableStatus === "invoiced" ? <QuickTransitionButton action="mark_payer_overdue" billingCase={billingCase} demoMode={demoMode} onChanged={onChanged} tone="secondary"><Clock3 size={16} /> Merkja gjaldfallið</QuickTransitionButton> : null}
            <details className="billing-dispute"><summary>Skrá ágreining</summary><TransitionForm action="dispute_payer" billingCase={billingCase} buttonLabel="Staðfesta ágreining" demoMode={demoMode} onChanged={onChanged} /></details>
          </>
        ) : null}
        {billingCase.receivableStatus === "disputed" ? <QuickTransitionButton action="reopen_payer" billingCase={billingCase} demoMode={demoMode} onChanged={onChanged} tone="secondary">Loka ágreiningi og opna aftur</QuickTransitionButton> : null}
        {billingCase.receivableStatus === "paid" ? (
          <>
            <p className="billing-paid-line"><Check size={16} /> Móttekið {formatBillingDate(billingCase.payerPaidAt)}</p>
            <QuickTransitionButton action="refund_payer" billingCase={billingCase} demoMode={demoMode} onChanged={onChanged} tone="danger">Skrá endurgreiðslu</QuickTransitionButton>
          </>
        ) : null}
        {billingCase.receivableStatus === "refunded" ? <p className="billing-refunded-line"><AlertTriangle size={16} /> Greiðsla hefur verið endurgreidd</p> : null}
      </article>

      <article className="billing-leg-card billing-leg-payable">
        <header><span><BanknoteArrowUp size={19} /></span><div><small>Vegstoð → þjónustuaðili</small><strong>{payableStatusLabels[billingCase.payableStatus]}</strong></div></header>
        <div className="billing-leg-amount">{formatIsk(billingCase.providerAmountIsk)}</div>
        <p className="billing-leg-provider">{billingCase.operatorName ?? "Enginn aðili skráður"}</p>
        {billingCase.providerInvoiceNumber ? <dl><div><dt>Reikningur</dt><dd>{billingCase.providerInvoiceNumber}</dd></div><div><dt>Gjalddagi</dt><dd className={providerPastDue ? "billing-overdue" : ""}>{formatBillingDate(billingCase.providerDueAt)}</dd></div></dl> : null}
        {billingCase.payableStatus === "awaiting_provider_invoice" ? <TransitionForm action="approve_provider_invoice" billingCase={billingCase} buttonLabel="Samþykkja reikning" demoMode={demoMode} onChanged={onChanged} requireInvoice /> : null}
        {billingCase.payableStatus === "approved" ? (
          <>
            <QuickTransitionButton action="record_provider_payment" billingCase={billingCase} demoMode={demoMode} onChanged={onChanged}><Check size={16} /> Skrá greitt til aðila</QuickTransitionButton>
            <details className="billing-dispute"><summary>Skrá ágreining</summary><TransitionForm action="dispute_provider" billingCase={billingCase} buttonLabel="Staðfesta ágreining" demoMode={demoMode} onChanged={onChanged} /></details>
          </>
        ) : null}
        {billingCase.payableStatus === "disputed" ? <QuickTransitionButton action="reopen_provider" billingCase={billingCase} demoMode={demoMode} onChanged={onChanged} tone="secondary">Loka ágreiningi og opna aftur</QuickTransitionButton> : null}
        {billingCase.payableStatus === "paid" ? <p className="billing-paid-line"><Check size={16} /> Greitt {formatBillingDate(billingCase.providerPaidAt)}</p> : null}
        {billingCase.payableStatus === "not_ready" ? <p className="billing-leg-help">Þessi hluti opnast þegar verkefninu lýkur og þjónustuaðili hefur verið skráður.</p> : null}
      </article>
    </section>
  );
}

export function BillingDetail({ billingCase, demoMode, events, onChanged }: BillingDetailProps) {
  if (!billingCase) {
    return <section className="billing-detail billing-detail-empty"><CircleDollarSign size={42} /><h2>Veldu verkefni</h2><p>Veldu verkefni til að vinna með greiðanda, reikning og uppgjör þjónustuaðila.</p></section>;
  }

  const caseEvents = events.filter((event) => event.jobId === billingCase.jobId);
  const closed = billingCase.jobStatus === "completed" || billingCase.jobStatus === "cancelled";

  return (
    <section className="billing-detail">
      <header className="billing-detail-header">
        <div>
          <div className="billing-detail-links">
            <Link href={`/?job=${billingCase.jobId}`}><ArrowLeft size={15} /> Opna í aðgerðastjórn</Link>
            <Link href={`/jobs/${billingCase.jobId}/history`}><History size={15} /> Allur ferill</Link>
          </div>
          <span className={`status-pill job-status-${billingCase.jobStatus}`}>{jobStatusLabels[billingCase.jobStatus]}</span>
          <h2>{billingCase.customerName}</h2>
          <p><MapPin size={15} /> {billingCase.locationLabel}</p>
        </div>
        <div className="billing-case-id"><small>Verkefni</small><code>{billingCase.jobId.slice(0, 8)}</code></div>
      </header>

      {!closed ? <div className="billing-operational-note"><Clock3 size={19} /><span><strong>Verkefnið er enn í vinnslu</strong><p>Skrá má greiðanda núna. Reikningsútgáfa og uppgjör þjónustuaðila opnast sjálfkrafa þegar verkefninu lýkur.</p></span></div> : null}
      {billingCase.receivableStatus === "missing_information" ? <div className="billing-warning"><AlertTriangle size={18} /><span><strong>Vantar greiðandaupplýsingar</strong><p>Skráðu hver greiðir Vegstoð og væntanlega heildarupphæð.</p></span></div> : null}

      {billingCase.jobStatus === "cancelled" && (billingCase.receivableStatus !== "void" || billingCase.payableStatus !== "void") ? (
        <div className="billing-void-panel"><AlertTriangle size={18} /><span><strong>Hætt var við verkefnið</strong><p>Ógiltu uppgjörið ef hvorki greiðandi né þjónustuaðili á að fá reikning vegna þess.</p></span><QuickTransitionButton action="void_billing" billingCase={billingCase} demoMode={demoMode} onChanged={onChanged} tone="danger">Ógilda uppgjör</QuickTransitionButton></div>
      ) : null}

      <MoneyLegs billingCase={billingCase} demoMode={demoMode} onChanged={onChanged} />
      <BillingDetailsForm key={billingCase.updatedAt} billingCase={billingCase} demoMode={demoMode} onChanged={onChanged} />

      <section className="billing-history">
        <div className="billing-section-heading"><div><p className="eyebrow">Rekjanleiki</p><h3>Uppgjörssaga</h3></div><History size={20} /></div>
        {caseEvents.length > 0 ? <ol>{caseEvents.map((event) => <li key={event.id}><span><FileCheck2 size={15} /></span><div><strong>{billingActionLabels[event.action]}</strong><p>{[event.reference, event.notes].filter(Boolean).join(" · ") || "Engin viðbótarathugasemd"}</p><small>{timestamp(event.changedAt)} · {event.changedByName}</small></div></li>)}</ol> : <p className="billing-history-empty">Engar uppgjörsaðgerðir hafa verið skráðar enn.</p>}
      </section>
    </section>
  );
}
