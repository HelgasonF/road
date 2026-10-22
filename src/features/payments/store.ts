import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentError } from "./mypos-config";
import type { PaymentEnvironment, PaymentPurpose, PaymentRequest, PaymentRow, ProviderPaymentDetails } from "./types";

const paymentRowSchema: z.ZodType<PaymentRow> = z.object({
  id: z.uuid(), job_id: z.uuid(), purpose: z.enum(["initial_fee", "service"]),
  provider: z.literal("mypos"), environment: z.enum(["sandbox", "production"]),
  merchant_id: z.string(), provider_api: z.string(), amount_isk: z.number().int().positive(),
  currency: z.literal("ISK"), reference: z.string(), provider_code: z.string().nullable(),
  payment_url: z.string().nullable(),
  status: z.enum(["creating", "creation_unknown", "creation_failed", "pending", "seen", "paid", "failed", "expired", "cancelled", "unknown"]),
  provider_status: z.string().nullable(), error_code: z.string().nullable(),
  created_by: z.uuid(), created_at: z.string(), last_verified_at: z.string().nullable(), paid_at: z.string().nullable(),
});

export function paymentFromRow(input: unknown): PaymentRequest {
  const result = paymentRowSchema.safeParse(input);
  if (!result.success) throw new PaymentError("payment_storage_error");
  const row = result.data;
  return {
    id: row.id, jobId: row.job_id, purpose: row.purpose, environment: row.environment,
    merchantId: row.merchant_id, providerApi: row.provider_api, amountIsk: row.amount_isk,
    currency: row.currency, reference: row.reference, providerCode: row.provider_code, paymentUrl: row.payment_url,
    status: row.status, providerStatus: row.provider_status, errorCode: row.error_code,
    createdAt: row.created_at, lastVerifiedAt: row.last_verified_at, paidAt: row.paid_at,
  };
}

export interface ReservationInput {
  jobId: string;
  purpose: PaymentPurpose;
  environment: PaymentEnvironment;
  merchantId: string;
  providerApi: string;
  amountIsk: number;
  createdBy: string;
}
export interface CreationOutcome {
  status: "pending" | "creation_unknown" | "creation_failed";
  code?: string;
  url?: string;
  errorCode?: string;
}
export interface PaymentStore {
  reserve(input: ReservationInput): Promise<{ claimed: boolean; request: PaymentRequest }>;
  finish(id: string, outcome: CreationOutcome): Promise<PaymentRequest>;
  get(id: string): Promise<PaymentRequest | null>;
  listForJob(jobId: string): Promise<PaymentRequest[]>;
  pending(environment: PaymentEnvironment, merchantId: string, providerApi: string): Promise<PaymentRequest[]>;
  record(id: string, details: ProviderPaymentDetails, checkedAt: string): Promise<PaymentRequest>;
}

export function createPaymentStore(): PaymentStore {
  const client = createAdminClient();
  return {
    async reserve(input) {
      const { data, error } = await client.rpc("reserve_job_payment_request", {
        p_job_id: input.jobId, p_purpose: input.purpose, p_environment: input.environment,
        p_merchant_id: input.merchantId, p_provider_api: input.providerApi,
        p_amount_isk: input.amountIsk, p_created_by: input.createdBy,
      });
      const parsed = z.object({ claimed: z.boolean(), request: paymentRowSchema }).safeParse(data);
      if (error || !parsed.success) throw new PaymentError("payment_storage_error");
      return { claimed: parsed.data.claimed, request: paymentFromRow(parsed.data.request) };
    },
    async finish(id, outcome) {
      const { data, error } = await client.rpc("finish_job_payment_creation", {
        p_id: id, p_provider_code: outcome.code ?? null, p_payment_url: outcome.url ?? null,
        p_status: outcome.status, p_error_code: outcome.errorCode ?? null,
      });
      if (error) throw new PaymentError("payment_storage_error");
      return paymentFromRow(data);
    },
    async get(id) {
      const { data, error } = await client.from("job_payment_requests").select("*").eq("id", id).maybeSingle();
      if (error) throw new PaymentError("payment_storage_error");
      return data ? paymentFromRow(data) : null;
    },
    async listForJob(jobId) {
      const { data, error } = await client.from("job_payment_requests").select("*").eq("job_id", jobId).order("created_at");
      if (error) throw new PaymentError("payment_storage_error");
      return (data ?? []).map(paymentFromRow);
    },
    async pending(environment, merchantId, providerApi) {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data, error } = await client.from("job_payment_requests").select("*")
        .eq("environment", environment).eq("merchant_id", merchantId).eq("provider_api", providerApi)
        .not("provider_code", "is", null).in("status", ["pending", "seen", "failed", "unknown"])
        .or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`)
        .order("last_verified_at", { nullsFirst: true }).order("created_at").limit(10);
      if (error) throw new PaymentError("payment_storage_error");
      return (data ?? []).map(paymentFromRow);
    },
    async record(id, details, checkedAt) {
      const { data, error } = await client.rpc("record_job_payment_status", {
        p_id: id, p_provider_code: details.code, p_amount_isk: details.amountIsk,
        p_currency: details.currency, p_reference: details.reference,
        p_provider_status: details.providerStatus, p_status: details.status, p_checked_at: checkedAt,
      });
      if (error) throw new PaymentError("payment_storage_error");
      return paymentFromRow(data);
    },
  };
}
