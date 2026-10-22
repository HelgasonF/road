import "server-only";

import type { CheckoutStore, InitialCheckoutInput, ServiceCheckoutInput } from "./checkout-store";
import { PaymentError } from "./mypos-config";
import { createPaymentService } from "./service";
import type { PaymentStore } from "./store";
import type { PaymentProvider } from "./types";

export function createCheckoutService(provider: PaymentProvider, payments: PaymentStore, checkouts: CheckoutStore) {
  const service = createPaymentService(provider, payments);
  return {
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
