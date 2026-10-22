import "server-only";

import { PaymentError } from "./mypos-config";
import type { PaymentStore, ReservationInput } from "./store";
import type { PaymentAccount, PaymentProvider, PaymentRequest, ProviderPaymentInput } from "./types";

function matchesAccount(request: PaymentRequest, account: PaymentAccount) {
  return request.environment === account.environment && request.merchantId === account.merchantId
    && request.providerApi === account.providerApi;
}

export function createPaymentService(provider: PaymentProvider, store: PaymentStore) {
  const account = provider.account;
  type Options = Omit<ProviderPaymentInput, "reference">;
  async function createReserved(input: Options, { claimed, request }: { claimed: boolean; request: PaymentRequest }) {
    if (!matchesAccount(request, account)) throw new PaymentError("payment_account_mismatch");
    if (request.amountIsk !== input.amountIsk) throw new PaymentError("payment_amount_locked");
    if (!claimed) {
      if (request.status === "expired" || request.status === "cancelled") throw new PaymentError("payment_request_closed");
      if (request.providerCode && request.paymentUrl) return request;
      // Never reclaim abandoned/failed/ambiguous reservations automatically.
      throw new PaymentError("payment_creation_unresolved", true);
    }

    let receipt: { code: string; url: string };
    try {
      receipt = await provider.create({
        amountIsk: request.amountIsk, reference: request.reference,
        customerName: input.customerName, language: input.language, expiryDate: input.expiryDate,
      });
    } catch (error) {
      const failure = error instanceof PaymentError ? error : new PaymentError("payment_creation_unresolved", true);
      try {
        await store.finish(request.id, {
          status: failure.uncertain ? "creation_unknown" : "creation_failed", errorCode: failure.code,
        });
      } catch {
        // The durable reservation remains in place even if this write fails.
        throw new PaymentError("payment_persistence_uncertain", true);
      }
      throw failure;
    }
    try {
      return await store.finish(request.id, { status: "pending", code: receipt.code, url: receipt.url });
    } catch {
      throw new PaymentError("payment_persistence_uncertain", true);
    }
  }
  return {
    // Trusted orchestration may reserve atomically alongside a private draft.
    // This method is server-only and never exposed as an action.
    createReserved,
    async create(input: Omit<ReservationInput, "environment" | "merchantId" | "providerApi"> & Omit<ProviderPaymentInput, "reference" | "amountIsk">) {
      await provider.prepare(input);
      return createReserved(input, await store.reserve({ ...input, ...account }));
    },

    async verify(request: PaymentRequest) {
      if (!matchesAccount(request, account)) throw new PaymentError("payment_account_mismatch");
      if (request.status === "paid") return request;
      if (!request.providerCode) throw new PaymentError("payment_creation_unresolved", true);
      const checkedAt = new Date().toISOString();
      const details = await provider.get(request.providerCode);
      if (details.code !== request.providerCode || details.amountIsk !== request.amountIsk
        || details.currency !== request.currency || details.reference !== request.reference) {
        throw new PaymentError("payment_response_mismatch");
      }
      return store.record(request.id, details, checkedAt);
    },

    async reconcile() {
      const requests = await store.pending(account.environment, account.merchantId, account.providerApi);
      let verified = 0;
      let failed = 0;
      const deadline = Date.now() + 20_000;
      // One bounded pass, no new scheduler, no sleeping, no automatic POSTs.
      for (const request of requests) {
        if (Date.now() >= deadline) break;
        try { await this.verify(request); verified++; }
        catch (error) {
          failed++;
          if (error instanceof PaymentError && ["payment_rate_limited", "payment_authentication_failed", "payment_permission_denied", "payment_provider_unavailable"].includes(error.code)) break;
        }
      }
      return { verified, failed };
    },
  };
}
