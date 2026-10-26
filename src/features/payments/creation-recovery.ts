import type { PaymentRequest } from "./types";

export function canRetryPaymentCreation(request: PaymentRequest) {
  return request.status === "creation_failed" && !request.providerCode && !request.paymentUrl
    && ["payment_provider_rejected", "payment_authentication_failed", "payment_permission_denied"].includes(request.errorCode ?? "");
}
