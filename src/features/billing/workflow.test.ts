import { describe, expect, it } from "vitest";

import type { JobBillingCase } from "./types";
import {
  billingCaseMatchesQueue,
  formatIsk,
  getBillingQueue,
  isBillingSettled,
} from "./workflow";

function makeCase(overrides: Partial<JobBillingCase> = {}): JobBillingCase {
  return {
    jobId: "30000000-0000-4000-8000-000000000001",
    customerName: "Sigríður Jónsdóttir",
    customerPhone: "555 0201",
    locationLabel: "Hella, Rangárþing ytra",
    jobStatus: "completed",
    completedAt: "2026-08-20T12:00:00Z",
    createdAt: "2026-08-20T10:00:00Z",
    operatorName: "Jón Einarsson",
    payerType: "customer",
    payerName: "Sigríður Jónsdóttir",
    payerKennitala: null,
    payerEmail: null,
    payerPhone: "555 0201",
    payerAddress: null,
    authorizationReference: null,
    billingReference: null,
    serviceSummary: "Dekkjaskipti",
    payerAmountIsk: 24_900,
    providerAmountIsk: 17_000,
    receivableStatus: "ready_to_invoice",
    payerInvoiceNumber: null,
    payerInvoiceIssuedAt: null,
    payerDueAt: null,
    payerPaidAt: null,
    payableStatus: "awaiting_provider_invoice",
    providerInvoiceNumber: null,
    providerInvoiceReceivedAt: null,
    providerDueAt: null,
    providerPaidAt: null,
    notes: null,
    updatedAt: "2026-08-20T12:00:00Z",
    ...overrides,
  };
}

describe("billing workflow", () => {
  it("keeps missing payer information ahead of the operational state", () => {
    expect(getBillingQueue(makeCase({
      jobStatus: "en_route",
      completedAt: null,
      payerType: null,
      payerName: null,
      receivableStatus: "missing_information",
      payableStatus: "not_ready",
    }))).toBe("missing_information");
  });

  it("places complete active jobs in the active billing queue", () => {
    expect(getBillingQueue(makeCase({
      jobStatus: "in_progress",
      completedAt: null,
      receivableStatus: "draft",
      payableStatus: "not_ready",
    }))).toBe("active");
  });

  it("moves completed jobs through invoice, provider-payment, and settlement queues", () => {
    expect(getBillingQueue(makeCase())).toBe("ready_to_invoice");
    expect(getBillingQueue(makeCase({ receivableStatus: "invoiced" }))).toBe("awaiting_payer_payment");
    expect(getBillingQueue(makeCase({
      receivableStatus: "paid",
      payerPaidAt: "2026-08-21T10:00:00Z",
      payableStatus: "approved",
    }))).toBe("provider_payment_due");
    expect(getBillingQueue(makeCase({
      receivableStatus: "paid",
      payerPaidAt: "2026-08-21T10:00:00Z",
      payableStatus: "paid",
      providerPaidAt: "2026-08-22T10:00:00Z",
    }))).toBe("settled");
  });

  it("surfaces either disputed money leg in one exception queue", () => {
    expect(getBillingQueue(makeCase({ receivableStatus: "disputed" }))).toBe("disputed");
    expect(getBillingQueue(makeCase({ payableStatus: "disputed" }))).toBe("disputed");
  });

  it("keeps refunds separate from disputes", () => {
    expect(getBillingQueue(makeCase({ receivableStatus: "refunded" }))).toBe("refunded");
  });

  it("matches overlapping provider work without hiding the primary queue", () => {
    const billingCase = makeCase({ receivableStatus: "invoiced", payableStatus: "approved" });

    expect(getBillingQueue(billingCase)).toBe("awaiting_payer_payment");
    expect(billingCaseMatchesQueue(billingCase, "provider_payment_due")).toBe(true);
    expect(billingCaseMatchesQueue(billingCase, "awaiting_payer_payment")).toBe(true);
  });

  it("requires both money legs to be paid before settlement", () => {
    expect(isBillingSettled(makeCase({ receivableStatus: "paid", payableStatus: "approved" }))).toBe(false);
    expect(isBillingSettled(makeCase({ receivableStatus: "paid", payableStatus: "paid" }))).toBe(true);
  });

  it("formats whole ISK deterministically without relying on browser locale data", () => {
    expect(formatIsk(1_234_567)).toBe("1.234.567 kr.");
    expect(formatIsk(-8_500)).toBe("−8.500 kr.");
    expect(formatIsk(null)).toBe("—");
  });
});
