"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { customerIntakeSchema, customerTokenSchema } from "@/features/customer-intake/schemas";
import { getActiveCustomerLinkByToken } from "@/features/customer-intake/queries";
import { customerLinkRequestAllowed, customerRateLimitError } from "@/features/customer-intake/rate-limit";
import { createCustomerIntakeToken, hashCustomerIntakeToken } from "@/features/customer-intake/tokens";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutService } from "./checkout-service";
import { createCheckoutStore } from "./checkout-store";
import { isCollectionEnabled, requireCollectionConfig, requireReconciliationConfig } from "./collection-config";
import { hasPaidInitialForIntake } from "./checkout-queries";
import { getInitialFeeIsk, PaymentError } from "./mypos-config";
import { MyPosProvider } from "./mypos";
import { paymentAmountSchema } from "./schemas";
import { createPaymentStore } from "./store";
import type { PaymentResult } from "./types";

const customerCheckoutSchema = customerIntakeSchema.extend({ language: z.enum(["en", "is"]) });
const serviceCheckoutSchema = z.object({ jobId: z.uuid(), amountIsk: paymentAmountSchema, description: z.string().trim().min(3).max(500) }).strict();

function failure(error: unknown, language: "en" | "is" = "en") {
  const errorCode = error instanceof PaymentError ? error.code : "payment_unavailable";
  const errorMessage = language === "is"
    ? errorCode === "payment_details_locked" ? "Upplýsingarnar eru læstar við greiðslubeiðnina. Hafðu samband við aðgerðastjórn til að leiðrétta þær."
      : ["payment_creation_unresolved", "payment_persistence_uncertain"].includes(errorCode)
        ? "Upplýsingarnar þínar eru vistaðar. Aðgerðastjórn þarf að kanna greiðslubeiðnina áður en þú reynir aftur."
        : "Ekki tókst að undirbúa greiðslu. Upplýsingarnar hafa ekki verið sendar. Hafðu samband við aðgerðastjórn."
    : errorCode === "payment_details_locked" ? "Your details are locked to the payment request. Contact dispatch to correct them."
      : ["payment_creation_unresolved", "payment_persistence_uncertain"].includes(errorCode)
        ? "Your details are saved. Dispatch needs to check the payment request before you try again."
        : "Payment is temporarily unavailable. Your details have not been submitted. Please contact dispatch.";
  return { ok: false as const, errorCode, error: errorMessage };
}

function context() {
  const config = requireCollectionConfig();
  const payments = createPaymentStore();
  return createCheckoutService(new MyPosProvider(config), payments, createCheckoutStore());
}

async function startCheckout(input: unknown): Promise<PaymentResult<{ checkoutUrl: string }>> {
  try {
    requireCollectionConfig();
    const parsed = customerCheckoutSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errorCode: "payment_invalid_input", error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    const { token, language, ...details } = parsed.data;
    if (!(await getActiveCustomerLinkByToken(token))) throw new PaymentError("payment_link_unavailable");
    if (await hasPaidInitialForIntake(token)) throw new PaymentError("payment_already_paid");
    const request = await context().startInitial({ tokenHash: hashCustomerIntakeToken(token), details, language, amountIsk: getInitialFeeIsk() });
    if (!request.paymentUrl) throw new PaymentError("payment_creation_unresolved", true);
    revalidatePath(`/customer/${token}`);
    return { ok: true, data: { checkoutUrl: request.paymentUrl } };
  } catch (error) { return failure(error, typeof input === "object" && input !== null && "language" in input && input.language === "is" ? "is" : "en"); }
}

export async function startCustomerCheckoutAction(input: unknown): Promise<PaymentResult<{ checkoutUrl: string }>> {
  if (!(await customerLinkRequestAllowed())) return { ok: false, errorCode: "payment_rate_limited", error: customerRateLimitError };
  return startCheckout(input);
}

/** Retry the exact saved draft; browser callers cannot replace its details. */
export async function resumeCustomerCheckoutAction(input: unknown): Promise<PaymentResult<{ checkoutUrl: string }>> {
  const parsed = z.object({ token: customerTokenSchema, language: z.enum(["en", "is"]) }).strict().safeParse(input);
  if (!parsed.success) return failure(new PaymentError("payment_invalid_input"));
  const { token, language } = parsed.data;
  if (!(await customerLinkRequestAllowed())) return { ok: false, errorCode: "payment_rate_limited", error: customerRateLimitError };
  try {
    requireCollectionConfig();
    if (!(await getActiveCustomerLinkByToken(token))) throw new PaymentError("payment_link_unavailable");
    const admin = createAdminClient();
    const { data: link, error } = await admin.from("customer_intake_links").select("id")
      .eq("token_hash", hashCustomerIntakeToken(token)).maybeSingle();
    if (error || !link) throw new PaymentError("payment_link_unavailable");
    const { data: draft, error: draftError } = await admin.from("customer_payment_intakes").select("details, language")
      .eq("customer_intake_link_id", link.id).maybeSingle();
    if (draftError || !draft) throw new PaymentError("payment_link_unavailable");
    const details = z.record(z.string(), z.unknown()).safeParse(draft.details);
    if (!details.success) throw new PaymentError("payment_storage_error");
    const result = await startCheckout({ ...details.data, token, language: draft.language });
    return result.ok ? result : failure(new PaymentError(result.errorCode), language);
  } catch (error) { return failure(error, language); }
}

export async function createServicePaymentLinkAction(input: unknown): Promise<PaymentResult<{ path: string }>> {
  try {
    const identity = await getVerifiedStaffSession();
    if (!identity) throw new PaymentError("staff_access_required");
    const parsed = serviceCheckoutSchema.safeParse(input);
    if (!parsed.success) throw new PaymentError("payment_invalid_input");
    const service = context();
    const client = await createClient();
    const { data: job, error } = await client.from("jobs").select("customer_name").eq("id", parsed.data.jobId).maybeSingle();
    if (error || !job) throw new PaymentError("payment_job_unavailable");
    const token = createCustomerIntakeToken();
    await service.startService({ ...parsed.data, createdBy: identity.id, customerName: job.customer_name,
      tokenHash: hashCustomerIntakeToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
    return { ok: true, data: { path: `/pay/${token}` } };
  } catch (error) { return failure(error); }
}

export async function getPaymentPanelAction(input: unknown) {
  try {
    if (!(await getVerifiedStaffSession())) throw new PaymentError("staff_access_required");
    const parsed = z.object({ jobId: z.uuid() }).strict().safeParse(input);
    if (!parsed.success) throw new PaymentError("payment_invalid_input");
    if (!isCollectionEnabled()) return { ok: true as const, data: { enabled: false, ready: false, environment: null, serviceDescription: null, intakeReviewRequired: false, requests: [] } };
    let ready = false;
    let environment: "sandbox" | "production" | null = null;
    try { environment = requireReconciliationConfig().environment; requireCollectionConfig(); ready = true; } catch { /* History remains readable while creation is disabled. */ }
    const requests = await createPaymentStore().listForJob(parsed.data.jobId);
    const second = requests.find((request) => request.environment === environment && request.purpose === "service");
    const first = requests.find((request) => request.environment === environment && request.purpose === "initial_fee");
    const admin = createAdminClient();
    const page = second ? await admin.from("job_payment_pages").select("description").eq("payment_request_id", second.id).maybeSingle() : null;
    const draft = first ? await admin.from("customer_payment_intakes").select("review_required").eq("payment_request_id", first.id).maybeSingle() : null;
    if (page?.error || draft?.error) throw new PaymentError("payment_storage_error");
    return { ok: true as const, data: { enabled: true, ready, environment,
      serviceDescription: page?.data?.description ?? null, intakeReviewRequired: draft?.data?.review_required ?? false, requests } };
  } catch (error) { return failure(error); }
}
