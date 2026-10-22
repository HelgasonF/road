import "server-only";

import { z } from "zod";
import type { customerIntakeSchema } from "@/features/customer-intake/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentError } from "./mypos-config";
import { paymentFromRow } from "./store";
import type { PaymentAccount, PaymentRequest } from "./types";

export type IntakeDetails = Omit<z.output<typeof customerIntakeSchema>, "token">;
export type InitialCheckoutInput = PaymentAccount & {
  tokenHash: string; details: IntakeDetails; language: "en" | "is"; amountIsk: number;
};
export type ServiceCheckoutInput = PaymentAccount & {
  jobId: string; amountIsk: number; description: string; createdBy: string; tokenHash: string; expiresAt: string;
};
export interface CheckoutStore {
  prepareInitial(input: InitialCheckoutInput): Promise<{ claimed: boolean; request: PaymentRequest }>;
  prepareService(input: ServiceCheckoutInput): Promise<{ claimed: boolean; request: PaymentRequest }>;
  claimDue(account: PaymentAccount): Promise<PaymentRequest[]>;
  finalize(paymentId: string): Promise<"submitted" | "review_required" | "not_ready" | "none">;
}

function reservation(data: unknown, error: unknown) {
  const parsed = z.object({ claimed: z.boolean(), request: z.unknown() }).safeParse(data);
  if (error || !parsed.success) {
    // Explicit application diagnostics only; never return a database message.
    const code = typeof error === "object" && error !== null && "message" in error ? error.message : null;
    if (code === "payment_details_locked" || code === "payment_link_unavailable") throw new PaymentError(code);
    throw new PaymentError("payment_storage_error");
  }
  return { claimed: parsed.data.claimed, request: paymentFromRow(parsed.data.request) };
}

export function createCheckoutStore(): CheckoutStore {
  const client = createAdminClient();
  return {
    async prepareInitial(input) {
      const { data, error } = await client.rpc("prepare_customer_payment_intake", {
        p_token_hash: input.tokenHash, p_details: input.details, p_language: input.language,
        p_environment: input.environment, p_merchant_id: input.merchantId, p_provider_api: input.providerApi,
        p_amount_isk: input.amountIsk,
      });
      return reservation(data, error);
    },
    async prepareService(input) {
      const { data, error } = await client.rpc("prepare_service_payment_page", {
        p_job_id: input.jobId, p_amount_isk: input.amountIsk, p_description: input.description,
        p_environment: input.environment, p_merchant_id: input.merchantId, p_provider_api: input.providerApi,
        p_created_by: input.createdBy, p_token_hash: input.tokenHash, p_expires_at: input.expiresAt,
      });
      return reservation(data, error);
    },
    async claimDue(account) {
      const { data, error } = await client.rpc("claim_due_job_payments", {
        p_environment: account.environment, p_merchant_id: account.merchantId, p_provider_api: account.providerApi,
      });
      if (error || !Array.isArray(data)) throw new PaymentError("payment_storage_error");
      return data.map(paymentFromRow);
    },
    async finalize(paymentId) {
      const { data, error } = await client.rpc("finalize_paid_customer_intake", { p_payment_id: paymentId });
      const parsed = z.enum(["submitted", "review_required", "not_ready", "none"]).safeParse(data);
      if (error || !parsed.success) throw new PaymentError("payment_finalization_unavailable");
      return parsed.data;
    },
  };
}
