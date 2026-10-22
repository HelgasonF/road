import "server-only";

import { isDemoMode } from "@/lib/config";
import { getInitialFeeIsk, getMyPosConfig, PaymentError } from "./mypos-config";

export function isCollectionEnabled() {
  return process.env.MYPOS_COLLECTION_ENABLED === "true" && !isDemoMode();
}

export function requireCollectionConfig() {
  const config = requireReconciliationConfig();
  if (config.environment === "production" && !config.livePaymentsEnabled) throw new PaymentError("live_payments_disabled");
  return config;
}

export function requireReconciliationConfig() {
  if (!isCollectionEnabled()) throw new PaymentError("payments_disabled");
  return getMyPosConfig();
}

export function getCustomerPaymentSettings() {
  if (!isCollectionEnabled()) return { enabled: false, ready: false, amountIsk: null };
  try {
    requireCollectionConfig();
    return { enabled: true, ready: true, amountIsk: getInitialFeeIsk() };
  } catch {
    // An incomplete enabled setup must never fall back to unpaid submission.
    return { enabled: true, ready: false, amountIsk: null };
  }
}
