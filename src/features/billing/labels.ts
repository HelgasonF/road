import type {
  BillingAction,
  BillingPayableStatus,
  BillingPayerType,
  BillingReceivableStatus,
} from "@/lib/domain/types";
import type { BillingQueue } from "./types";

export const payerTypeLabels: Record<BillingPayerType, string> = {
  customer: "Viðskiptavinur",
  rental_company: "Bílaleiga",
  insurer: "Tryggingafélag / aðstoðarþjónusta",
  business_account: "Fyrirtæki / flotareikningur",
};

export const receivableStatusLabels: Record<BillingReceivableStatus, string> = {
  missing_information: "Vantar greiðandaupplýsingar",
  draft: "Drög",
  ready_to_invoice: "Tilbúið til reiknings",
  invoiced: "Reikningur útgefinn",
  paid: "Greitt til Vegstoðar",
  overdue: "Komið fram yfir gjalddaga",
  disputed: "Ágreiningur",
  refunded: "Endurgreitt",
  void: "Ógilt",
};

export const payableStatusLabels: Record<BillingPayableStatus, string> = {
  not_ready: "Ekki komið að uppgjöri",
  awaiting_provider_invoice: "Bíður reiknings þjónustuaðila",
  approved: "Reikningur samþykktur",
  paid: "Greitt til þjónustuaðila",
  disputed: "Ágreiningur",
  void: "Ógilt",
};

export const billingQueueLabels: Record<BillingQueue, string> = {
  all: "Öll verkefni",
  missing_information: "Vantar upplýsingar",
  active: "Virk verkefni",
  ready_to_invoice: "Til reiknings",
  awaiting_payer_payment: "Bíður greiðslu",
  provider_payment_due: "Þjónustuaðili",
  settled: "Fulluppgert",
  disputed: "Ágreiningur",
  refunded: "Endurgreitt",
  void: "Ógilt",
};

export const billingActionLabels: Record<BillingAction, string> = {
  details_updated: "Uppgjörsupplýsingar uppfærðar",
  issue_payer_invoice: "Reikningur gefinn út til greiðanda",
  record_payer_payment: "Greiðsla móttekin frá greiðanda",
  mark_payer_overdue: "Reikningur merktur gjaldfallinn",
  dispute_payer: "Ágreiningur skráður við greiðanda",
  refund_payer: "Endurgreiðsla skráð",
  approve_provider_invoice: "Reikningur þjónustuaðila samþykktur",
  record_provider_payment: "Greiðsla skráð til þjónustuaðila",
  dispute_provider: "Ágreiningur skráður við þjónustuaðila",
  reopen_payer: "Ágreiningur greiðanda opnaður aftur",
  reopen_provider: "Ágreiningur þjónustuaðila opnaður aftur",
  void_billing: "Uppgjör ógilt",
};
