import "server-only";

import type { CheckoutStore, InitialCheckoutInput, ServiceCheckoutInput } from "./checkout-store";
import { PaymentError } from "./mypos-config";
import { createPaymentService } from "./service";
import type { PaymentStore } from "./store";
import type { PaymentProvider } from "./types";
import { canRetryPaymentCreation } from "./creation-recovery";

export function createCheckoutService(provider: PaymentProvider, payments: PaymentStore, checkouts: CheckoutStore) {
  const service = createPaymentService(provider, payments);
  async function verifyServicePayments(jobId: string) {
    const requests = (await payments.listForJob(jobId)).filter((request) =>
      request.purpose === "service" && request.environment === provider.account.environment);
    if (requests.some((request) => request.merchantId !== provider.account.merchantId || request.providerApi !== provider.account.providerApi)) {
      throw new PaymentError("payment_account_mismatch");
    }
    if (requests.some((request) => request.status === "paid")) throw new PaymentError("payment_already_paid");
    const deadline = Date.now() + 20_000;
    for (const request of requests) {
      if (Date.now() >= deadline) throw new PaymentError("payment_verification_unavailable");
      if (!request.providerCode) {
        if (!canRetryPaymentCreation(request)) throw new PaymentError("payment_creation_unresolved");
        continue;
      }
      const checked = await service.verify(request);
      if (checked.status === "paid") throw new PaymentError("payment_already_paid");
      if (checked.status === "unknown") throw new PaymentError("payment_creation_unresolved");
    }
  }
  return {
    verifyServicePayments,
    async startInitial(input: Omit<InitialCheckoutInput, "environment" | "merchantId" | "providerApi">) {
      const options = { amountIsk: input.amountIsk, customerName: input.details.customerName, language: input.language };
      await provider.prepare(options);
      const reservation = await checkouts.prepareInitial({ ...input, ...provider.account });
      return service.createReserved(options, reservation);
    },
    async startService(input: Omit<ServiceCheckoutInput, "environment" | "merchantId" | "providerApi"> & { customerName: string }) {
      const options = { amountIsk: input.amountIsk, customerName: input.customerName };
      await provider.prepare(options);
      const reservation = await checkouts.prepareService({ ...input, ...provider.account });
      return service.createReserved(options, reservation);
    },
    async replaceService(input: Omit<ServiceCheckoutInput, "environment" | "merchantId" | "providerApi"> & { paymentId: string; customerName: string }) {
      const previous = await payments.get(input.paymentId);
      if (!previous || previous.purpose !== "service" || previous.jobId !== input.jobId) throw new PaymentError("payment_not_found");
      if (previous.environment !== provider.account.environment || previous.merchantId !== provider.account.merchantId
        || previous.providerApi !== provider.account.providerApi) throw new PaymentError("payment_account_mismatch");
      const options = { amountIsk: input.amountIsk, customerName: input.customerName };
      await provider.prepare(options);
      await verifyServicePayments(input.jobId);
      const reservation = await checkouts.replaceService({ ...input, ...provider.account });
      return service.createReserved(options, reservation);
    },
    async reconcile() {
      const requests = await checkouts.claimDue(provider.account);
      const deadline = Date.now() + 20_000;
      let verified = 0, submitted = 0, failed = 0, reviewRequired = 0;
      for (const request of requests) {
        if (Date.now() >= deadline) break;
        try {
          const checked = await service.verify(request);
          verified++;
          if (checked.status === "paid" && checked.purpose === "initial_fee") {
            const result = await checkouts.finalize(checked.id);
            if (result === "submitted") submitted++;
            if (result === "review_required") reviewRequired++;
          }
        } catch (error) {
          failed++;
          if (error instanceof PaymentError && ["payment_rate_limited", "payment_authentication_failed", "payment_permission_denied", "payment_provider_unavailable"].includes(error.code)) break;
        }
      }
      return { verified, submitted, failed, reviewRequired };
    },
  };
}
