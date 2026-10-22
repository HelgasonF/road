import type { Metadata } from "next";

import { CustomerIntakeForm } from "@/features/customer-intake/customer-intake-form";
import { getCustomerIntakePageData } from "@/features/customer-intake/queries";
import { getCustomerPaymentSettings } from "@/features/payments/collection-config";
import { getInitialCheckoutSummary, hasPaidInitialForIntake } from "@/features/payments/checkout-queries";
import { PaymentSummary } from "@/features/payments/payment-summary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm roadside assistance details — Iceland Road Assistance",
  description: "Share your location and vehicle details securely with Iceland Road Assistance.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function CustomerIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const intake = await getCustomerIntakePageData(token);

  if (intake.status === "submitted") {
    return (
      <main className="customer-intake-page customer-intake-state">
        <div className="customer-intake-brand"><span aria-hidden="true">IR</span><strong>Iceland Road Assistance</strong></div>
        <section>
          <span className="customer-state-icon customer-state-success">✓</span>
          <h1>Thank you — details received</h1>
          <p lang="is">Takk — upplýsingarnar hafa verið mótteknar.</p>
          <small>Iceland Road Assistance dispatch now has the location, vehicle information and photos you submitted.</small>
          <small lang="is">Aðgerðastjórn Iceland Road Assistance hefur nú fengið staðsetninguna, upplýsingar um ökutækið og myndirnar sem þú sendir.</small>
        </section>
      </main>
    );
  }

  if (intake.status !== "active") {
    return (
      <main className="customer-intake-page customer-intake-state">
        <div className="customer-intake-brand"><span aria-hidden="true">IR</span><strong>Iceland Road Assistance</strong></div>
        <section>
          <span className="customer-state-icon">!</span>
          <h1>This link is no longer available</h1>
          <p lang="is">Þessi tengill er ekki lengur virkur.</p>
          <small>Please call Iceland Road Assistance and ask dispatch for a new secure link.</small>
          <small lang="is">Hringdu í Iceland Road Assistance og biddu aðgerðastjórn um nýjan öruggan tengil.</small>
        </section>
      </main>
    );
  }

  let payment = getCustomerPaymentSettings();
  let summary = null;
  if (payment.enabled) {
    try {
      summary = await getInitialCheckoutSummary(token);
      if (!summary && await hasPaidInitialForIntake(token)) payment = { enabled: false, ready: false, amountIsk: null };
    } catch {
      payment = { enabled: true, ready: false, amountIsk: null };
    }
  }

  if (summary) return <PaymentSummary summary={summary} />;

  return (
    <CustomerIntakeForm
      expiresAt={intake.expiresAt}
      initialPhotos={intake.photos}
      job={intake.job}
      token={token}
      payment={payment}
    />
  );
}
