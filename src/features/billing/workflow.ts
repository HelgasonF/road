import type { BillingQueue, JobBillingCase } from "./types";

const closedOperationalStatuses = new Set(["completed", "cancelled"]);

export function isBillingSettled(billingCase: JobBillingCase) {
  return billingCase.receivableStatus === "paid" && billingCase.payableStatus === "paid";
}

export function getBillingQueue(billingCase: JobBillingCase): Exclude<BillingQueue, "all"> {
  if (
    billingCase.receivableStatus === "disputed"
    || billingCase.payableStatus === "disputed"
  ) return "disputed";

  if (billingCase.receivableStatus === "refunded") return "refunded";

  if (
    billingCase.receivableStatus === "void"
    && billingCase.payableStatus === "void"
  ) return "void";

  if (
    billingCase.receivableStatus === "missing_information"
    || !billingCase.payerType
    || !billingCase.payerName
  ) return "missing_information";

  if (!closedOperationalStatuses.has(billingCase.jobStatus)) return "active";
  if (isBillingSettled(billingCase)) return "settled";

  if (
    billingCase.receivableStatus === "ready_to_invoice"
    || billingCase.receivableStatus === "draft"
  ) return "ready_to_invoice";

  if (
    billingCase.receivableStatus === "invoiced"
    || billingCase.receivableStatus === "overdue"
  ) return "awaiting_payer_payment";

  if (
    billingCase.payableStatus === "awaiting_provider_invoice"
    || billingCase.payableStatus === "approved"
  ) return "provider_payment_due";

  return "settled";
}

export function billingCaseMatchesQueue(billingCase: JobBillingCase, queue: BillingQueue) {
  if (queue === "all") return true;
  if (queue === "provider_payment_due") {
    return billingCase.payableStatus === "awaiting_provider_invoice"
      || billingCase.payableStatus === "approved";
  }
  if (queue === "awaiting_payer_payment") {
    return billingCase.receivableStatus === "invoiced"
      || billingCase.receivableStatus === "overdue";
  }
  return getBillingQueue(billingCase) === queue;
}

export function formatIsk(amount: number | null) {
  if (amount === null) return "—";
  const absolute = Math.abs(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${amount < 0 ? "−" : ""}${absolute} kr.`;
}

export function formatBillingDate(value: string | null) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

export function isPastDue(dueDate: string | null, today = new Date()) {
  if (!dueDate) return false;
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return dueDate < localToday;
}
