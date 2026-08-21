import { describe, expect, it } from "vitest";

import { billingDetailsSchema, billingTransitionSchema } from "./schemas";

const jobId = "30000000-0000-4000-8000-000000000001";

describe("billingDetailsSchema", () => {
  it("accepts a complete payer and provider settlement draft", () => {
    const result = billingDetailsSchema.parse({
      jobId,
      payerType: "rental_company",
      payerName: "Bílaleiga Íslands ehf.",
      payerKennitala: "550101-1230",
      payerEmail: "reikningar@example.is",
      payerPhone: "+354 555 0100",
      payerAddress: "Keflavíkurflugvöllur, 235 Reykjanesbær",
      authorizationReference: "AUTH-1042",
      billingReference: "PO-881",
      serviceSummary: "Dráttur af Suðurlandsvegi til Selfoss",
      payerAmountIsk: 42_900,
      providerAmountIsk: 31_000,
      notes: "Samþykkt af vaktstjóra bílaleigu.",
    });

    expect(result.payerType).toBe("rental_company");
    expect(result.payerAmountIsk).toBe(42_900);
    expect(result.providerAmountIsk).toBe(31_000);
  });

  it("allows an incomplete record so it can stay in the missing-information queue", () => {
    const result = billingDetailsSchema.parse({
      jobId,
      payerType: null,
      payerName: "",
      payerKennitala: "",
      payerEmail: "",
      payerPhone: "",
      payerAddress: "",
      authorizationReference: "",
      billingReference: "",
      serviceSummary: "",
      payerAmountIsk: null,
      providerAmountIsk: null,
      notes: "",
    });

    expect(result.payerName).toBeNull();
    expect(result.payerEmail).toBeNull();
    expect(result.notes).toBeNull();
  });

  it("rejects negative or fractional ISK totals", () => {
    const base = {
      jobId,
      payerType: "customer" as const,
      payerName: "Sigríður Jónsdóttir",
      payerKennitala: "",
      payerEmail: "",
      payerPhone: "555 0101",
      payerAddress: "",
      authorizationReference: "",
      billingReference: "",
      serviceSummary: "Dekkjaskipti",
      payerAmountIsk: 12_000,
      providerAmountIsk: 8_000,
      notes: "",
    };

    expect(billingDetailsSchema.safeParse({ ...base, payerAmountIsk: -1 }).success).toBe(false);
    expect(billingDetailsSchema.safeParse({ ...base, providerAmountIsk: 12.5 }).success).toBe(false);
  });

  it("rejects malformed payer email addresses", () => {
    expect(billingDetailsSchema.safeParse({
      jobId,
      payerType: "insurer",
      payerName: "Tryggingafélag",
      payerKennitala: "",
      payerEmail: "ekki-netfang",
      payerPhone: "",
      payerAddress: "",
      authorizationReference: "",
      billingReference: "",
      serviceSummary: "",
      payerAmountIsk: null,
      providerAmountIsk: null,
      notes: "",
    }).success).toBe(false);
  });
});

describe("billingTransitionSchema", () => {
  it("requires an invoice reference and due date when issuing a payer invoice", () => {
    expect(billingTransitionSchema.safeParse({
      jobId,
      action: "issue_payer_invoice",
      reference: "VS-2026-0042",
      dueDate: "2026-09-03",
      notes: "",
    }).success).toBe(true);

    expect(billingTransitionSchema.safeParse({
      jobId,
      action: "issue_payer_invoice",
      reference: "",
      dueDate: null,
      notes: "",
    }).success).toBe(false);
  });

  it("requires a reason when either money leg is disputed", () => {
    expect(billingTransitionSchema.safeParse({
      jobId,
      action: "dispute_payer",
      reference: null,
      dueDate: null,
      notes: "Upphæð stenst ekki samþykkt tilboð.",
    }).success).toBe(true);

    expect(billingTransitionSchema.safeParse({
      jobId,
      action: "dispute_provider",
      reference: null,
      dueDate: null,
      notes: "",
    }).success).toBe(false);
  });

  it("allows payment actions without duplicate invoice fields", () => {
    expect(billingTransitionSchema.parse({
      jobId,
      action: "record_provider_payment",
      reference: null,
      dueDate: null,
      notes: "Greitt með bankafærslu.",
    }).action).toBe("record_provider_payment");
  });
});
