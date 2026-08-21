"use client";

import {
  Banknote,
  BriefcaseBusiness,
  CircleUserRound,
  FileClock,
  LogOut,
  MapPinned,
  ReceiptText,
  Search,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { logoutAction } from "@/features/auth/actions";
import type { DispatcherIdentity } from "@/lib/domain/types";
import { jobStatusLabels } from "@/lib/i18n/is";
import { BillingDetail } from "./billing-detail";
import { billingQueueLabels, receivableStatusLabels } from "./labels";
import type { BillingQueue, JobBillingCase, JobBillingEvent } from "./types";
import { billingCaseMatchesQueue, formatIsk, getBillingQueue } from "./workflow";

interface BillingWorkspaceProps {
  billingCases: JobBillingCase[];
  demoMode: boolean;
  events: JobBillingEvent[];
  identity: DispatcherIdentity;
  initialJobId: string | null;
}

const queues: BillingQueue[] = [
  "all",
  "missing_information",
  "active",
  "ready_to_invoice",
  "awaiting_payer_payment",
  "provider_payment_due",
  "settled",
  "disputed",
  "refunded",
  "void",
];

export function BillingWorkspace({ billingCases, demoMode, events, identity, initialJobId }: BillingWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<BillingQueue>("all");
  const [selectedJobId, setSelectedJobId] = useState(
    billingCases.some((item) => item.jobId === initialJobId)
      ? initialJobId
      : billingCases.find((item) => getBillingQueue(item) !== "settled")?.jobId ?? billingCases[0]?.jobId ?? null,
  );

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("is");
    return billingCases.filter((billingCase) => {
      const textMatches = !normalized || [
        billingCase.customerName,
        billingCase.payerName,
        billingCase.locationLabel,
        billingCase.operatorName,
        billingCase.payerInvoiceNumber,
        billingCase.providerInvoiceNumber,
        billingCase.authorizationReference,
      ].filter(Boolean).some((value) => value!.toLocaleLowerCase("is").includes(normalized));
      return textMatches && billingCaseMatchesQueue(billingCase, queue);
    });
  }, [billingCases, query, queue]);

  const selectedCase = billingCases.find((item) => item.jobId === selectedJobId) ?? null;
  const missingCount = billingCases.filter((item) => getBillingQueue(item) === "missing_information").length;
  const readyCount = billingCases.filter((item) => getBillingQueue(item) === "ready_to_invoice").length;
  const outstanding = billingCases
    .filter((item) => item.receivableStatus === "invoiced" || item.receivableStatus === "overdue" || item.receivableStatus === "disputed")
    .reduce((sum, item) => sum + (item.payerAmountIsk ?? 0), 0);
  const providerDue = billingCases
    .filter((item) => item.payableStatus === "approved")
    .reduce((sum, item) => sum + (item.providerAmountIsk ?? 0), 0);

  return (
    <main className="billing-app">
      <header className="topbar billing-topbar">
        <div className="brand-lockup"><span className="brand-mark"><MapPinned size={22} /></span><span><strong>Vegstoð</strong><small>Uppgjör og reikningar</small></span></div>
        <nav className="billing-nav" aria-label="Aðalvalmynd">
          <Link href="/"><BriefcaseBusiness size={16} /> Aðgerðastjórn</Link>
          <Link className="billing-nav-active" href="/billing"><ReceiptText size={16} /> Uppgjör</Link>
        </nav>
        <div className="topbar-actions">
          {demoMode ? <span className="demo-badge">Sýnishamur</span> : null}
          <div className="identity"><CircleUserRound size={26} /><span><strong>{identity.displayName}</strong><small>{identity.email}</small></span></div>
          <form action={logoutAction}><button className="icon-button" type="submit" aria-label="Skrá út"><LogOut size={18} /></button></form>
        </div>
      </header>

      <section className="billing-overview">
        <div className="billing-overview-heading"><p className="eyebrow">Fjármálaflæði</p><h1>Uppgjör verkefna</h1><p>Greiðandi greiðir Vegstoð. Vegstoð gerir síðan upp við þjónustuaðila.</p></div>
        <div className="billing-metrics">
          <article><span className="billing-metric-icon metric-warning"><ShieldAlert size={19} /></span><div><small>Vantar upplýsingar</small><strong>{missingCount}</strong></div></article>
          <article><span className="billing-metric-icon metric-ready"><FileClock size={19} /></span><div><small>Til reiknings</small><strong>{readyCount}</strong></div></article>
          <article><span className="billing-metric-icon metric-receivable"><WalletCards size={19} /></span><div><small>Útistandandi</small><strong>{formatIsk(outstanding)}</strong></div></article>
          <article><span className="billing-metric-icon metric-payable"><Banknote size={19} /></span><div><small>Samþykkt til greiðslu</small><strong>{formatIsk(providerDue)}</strong></div></article>
        </div>
      </section>

      <section className="billing-shell">
        <aside className="billing-sidebar">
          <label className="search-box"><Search size={17} /><input aria-label="Leita í uppgjöri" placeholder="Viðskiptavinur, greiðandi eða reikningur…" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="billing-queue-select"><span>Sía uppgjör</span><select value={queue} onChange={(event) => setQueue(event.target.value as BillingQueue)}>{queues.map((item) => <option key={item} value={item}>{billingQueueLabels[item]}</option>)}</select></label>
          <div className="billing-case-count">{filteredCases.length === 1 ? "1 verkefni" : `${filteredCases.length} verkefni`}</div>
          <div className="billing-case-list">
            {filteredCases.map((billingCase) => {
              const caseQueue = getBillingQueue(billingCase);
              return (
                <button className={`billing-case-row ${billingCase.jobId === selectedJobId ? "billing-case-row-selected" : ""}`} key={billingCase.jobId} type="button" onClick={() => setSelectedJobId(billingCase.jobId)}>
                  <span className={`billing-queue-dot billing-queue-${caseQueue}`} />
                  <span><strong>{billingCase.customerName}</strong><small>{billingCase.payerName ?? "Greiðandi óskráður"}</small><i>{jobStatusLabels[billingCase.jobStatus]} · {caseQueue === "settled" || caseQueue === "provider_payment_due" || caseQueue === "void" ? billingQueueLabels[caseQueue] : receivableStatusLabels[billingCase.receivableStatus]}</i></span>
                  <b>{formatIsk(billingCase.payerAmountIsk)}</b>
                </button>
              );
            })}
            {filteredCases.length === 0 ? <p className="billing-empty-list">Engin verkefni fundust í þessari síu.</p> : null}
          </div>
        </aside>

        <BillingDetail
          key={`${selectedCase?.jobId ?? "empty"}-${selectedCase?.updatedAt ?? "none"}`}
          billingCase={selectedCase}
          demoMode={demoMode}
          events={events}
          onChanged={() => router.refresh()}
        />
      </section>
    </main>
  );
}
