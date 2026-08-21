import type { Job } from "@/lib/domain/types";
import type { JobBillingRecord } from "./types";

export function buildDemoBillingRecords(jobs: Job[]): JobBillingRecord[] {
  return jobs.map((job, index) => ({
    jobId: job.id,
    payerType: index === 0 ? null : "business_account",
    payerName: index === 0 ? null : "Norðurferð ehf.",
    payerKennitala: null,
    payerEmail: index === 0 ? null : "reikningar@example.is",
    payerPhone: index === 0 ? null : "+354 555 0400",
    payerAddress: null,
    authorizationReference: index === 0 ? null : "FERD-2041",
    billingReference: null,
    serviceSummary: index === 0 ? null : "Aðstoð við rafbíl",
    payerAmountIsk: index === 0 ? null : 38_900,
    providerAmountIsk: index === 0 ? null : 27_500,
    receivableStatus: index === 0 ? "missing_information" : "draft",
    payerInvoiceNumber: null,
    payerInvoiceIssuedAt: null,
    payerDueAt: null,
    payerPaidAt: null,
    payableStatus: "not_ready",
    providerInvoiceNumber: null,
    providerInvoiceReceivedAt: null,
    providerDueAt: null,
    providerPaidAt: null,
    notes: null,
    updatedAt: job.updatedAt,
  }));
}
