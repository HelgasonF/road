import type {
  BillingAction,
  BillingPayableStatus,
  BillingPayerType,
  BillingReceivableStatus,
  JobStatus,
} from "@/lib/domain/types";

export interface JobBillingRecord {
  jobId: string;
  payerType: BillingPayerType | null;
  payerName: string | null;
  payerKennitala: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  payerAddress: string | null;
  authorizationReference: string | null;
  billingReference: string | null;
  serviceSummary: string | null;
  payerAmountIsk: number | null;
  providerAmountIsk: number | null;
  receivableStatus: BillingReceivableStatus;
  payerInvoiceNumber: string | null;
  payerInvoiceIssuedAt: string | null;
  payerDueAt: string | null;
  payerPaidAt: string | null;
  payableStatus: BillingPayableStatus;
  providerInvoiceNumber: string | null;
  providerInvoiceReceivedAt: string | null;
  providerDueAt: string | null;
  providerPaidAt: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface JobBillingCase extends JobBillingRecord {
  customerName: string;
  customerPhone: string;
  locationLabel: string;
  jobStatus: JobStatus;
  completedAt: string | null;
  createdAt: string;
  operatorName: string | null;
}

export interface JobBillingEvent {
  id: number;
  jobId: string;
  action: BillingAction;
  reference: string | null;
  dueAt: string | null;
  notes: string | null;
  changedByName: string;
  changedAt: string;
}

export type BillingQueue =
  | "all"
  | "missing_information"
  | "active"
  | "ready_to_invoice"
  | "awaiting_payer_payment"
  | "provider_payment_due"
  | "settled"
  | "disputed"
  | "refunded"
  | "void";
