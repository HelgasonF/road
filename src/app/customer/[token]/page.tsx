import type { Metadata } from "next";

import { CustomerIntakeForm } from "@/features/customer-intake/customer-intake-form";
import { getCustomerIntakePageData } from "@/features/customer-intake/queries";

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
          <p>Takk — upplýsingarnar hafa verið mótteknar.</p>
          <small>Iceland Road Assistance dispatch now has the location, vehicle information and photos you submitted.</small>
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
          <p>Þessi tengill er ekki lengur virkur.</p>
          <small>Please call Iceland Road Assistance and ask dispatch for a new secure link.</small>
        </section>
      </main>
    );
  }

  return (
    <CustomerIntakeForm
      expiresAt={intake.expiresAt}
      initialPhotos={intake.photos}
      job={intake.job}
      token={token}
    />
  );
}
