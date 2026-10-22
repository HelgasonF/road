"use server";

import { getVerifiedStaffSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { MyPosProvider } from "./mypos";
import { getInitialFeeIsk, getMyPosConfig, PaymentError } from "./mypos-config";
import { createPaymentSchema, paymentJobSchema, verifyPaymentSchema } from "./schemas";
import { createPaymentService } from "./service";
import { createPaymentStore } from "./store";
import type { PaymentResult } from "./types";

function failure(error: unknown) {
  const errorCode = error instanceof PaymentError ? error.code : "payment_unavailable";
  return {
    ok: false as const,
    error: errorCode === "payment_creation_unresolved" || errorCode === "payment_persistence_uncertain"
      ? "Óvíst er hvort greiðslubeiðni var búin til. Staðfestu stöðuna áður en ný beiðni er gerð."
      : "Ekki tókst að afgreiða greiðslubeiðnina.",
    errorCode,
  };
}

async function withPayments<T>(work: (identity: { id: string }) => Promise<T>): Promise<PaymentResult<T>> {
  if (isDemoMode()) return failure(new PaymentError("read_only_demo"));
  try {
    const identity = await getVerifiedStaffSession();
    if (!identity) return failure(new PaymentError("staff_access_required"));
    return { ok: true, data: await work(identity) };
  }
  catch (error) { return failure(error); }
}

function context() {
  const config = getMyPosConfig();
  const store = createPaymentStore();
  return { store, service: createPaymentService(new MyPosProvider(config), store) };
}

/** Backend contract for the existing intake/message caller. Never sends text. */
export async function createJobPaymentRequestAction(input: unknown) {
  return withPayments(async (identity) => {
    const parsed = createPaymentSchema.safeParse(input);
    if (!parsed.success) throw new PaymentError("payment_invalid_input");
    const value = parsed.data;
    const { service } = context();
    const client = await createClient();
    const { data: job, error } = await client.from("jobs").select("id, customer_name").eq("id", value.jobId).maybeSingle();
    if (error || !job) throw new PaymentError("payment_job_unavailable");
    return service.create({
      jobId: job.id, purpose: value.purpose, createdBy: identity.id,
      amountIsk: value.purpose === "initial_fee" ? getInitialFeeIsk() : value.amountIsk,
      customerName: job.customer_name || undefined,
      language: value.language, expiryDate: value.expiryDate,
    });
  });
}

export async function verifyJobPaymentRequestAction(input: unknown) {
  return withPayments(async () => {
    const parsed = verifyPaymentSchema.safeParse(input);
    if (!parsed.success) throw new PaymentError("payment_invalid_input");
    const { store, service } = context();
    const request = await store.get(parsed.data.paymentId);
    if (!request) throw new PaymentError("payment_not_found");
    return service.verify(request);
  });
}

export async function getJobPaymentRequestsAction(input: unknown) {
  return withPayments(async () => {
    const parsed = paymentJobSchema.safeParse(input);
    if (!parsed.success) throw new PaymentError("payment_invalid_input");
    // Listing history needs staff authorization, but not active myPOS access.
    return createPaymentStore().listForJob(parsed.data.jobId);
  });
}

export async function reconcilePendingJobPaymentsAction() {
  return withPayments(async () => context().service.reconcile());
}
