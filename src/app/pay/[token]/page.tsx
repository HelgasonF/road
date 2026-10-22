import type { Metadata } from "next";
import { getServicePaymentSummary } from "@/features/payments/checkout-queries";
import { customerLinkRequestAllowed } from "@/features/customer-intake/rate-limit";
import { PaymentSummary } from "@/features/payments/payment-summary";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Service payment — Iceland Road Assistance",
  robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer",
};

export default async function ServicePaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let summary = null;
  try { if (await customerLinkRequestAllowed()) summary = await getServicePaymentSummary(token); }
  catch { /* Public links expose neither internal errors nor account information. */ }
  if (summary) return <PaymentSummary summary={summary} />;
  return <main className="customer-intake-page customer-intake-state"><div className="customer-intake-brand"><span aria-hidden="true">IR</span><strong>Iceland Road Assistance</strong></div><section><h1>This payment link is unavailable</h1><p>Please contact Iceland Road Assistance dispatch for help.</p><p lang="is">Hafðu samband við aðgerðastjórn Iceland Road Assistance til að fá aðstoð.</p></section></main>;
}
