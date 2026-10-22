import "server-only";

import { customerTokenSchema } from "@/features/customer-intake/schemas";
import { hashCustomerIntakeToken } from "@/features/customer-intake/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCollectionEnabled, requireReconciliationConfig } from "./collection-config";
import { PaymentError } from "./mypos-config";
import { safeCheckoutUrl, type PublicPaymentSummary } from "./public-summary";
import { createPaymentStore } from "./store";
import type { PaymentRequest } from "./types";

function currentAccount(request: PaymentRequest) {
  const config = requireReconciliationConfig();
  return request.environment === config.environment && request.merchantId === config.clientId && request.providerApi === "rest_v1_1";
}

async function checkoutAllowedForJob(request: PaymentRequest) {
  const { data, error } = await createAdminClient().from("jobs").select("status").eq("id", request.jobId).maybeSingle();
  if (error) throw new PaymentError("payment_storage_error");
  return Boolean(data && data.status !== "cancelled" && !(request.purpose === "initial_fee" && data.status === "completed"));
}

export async function getInitialCheckoutSummary(token: string): Promise<PublicPaymentSummary | null> {
  if (!isCollectionEnabled() || !customerTokenSchema.safeParse(token).success) return null;
  const admin = createAdminClient();
  const { data: link, error } = await admin.from("customer_intake_links")
    .select("id, expires_at, revoked_at").eq("token_hash", hashCustomerIntakeToken(token)).maybeSingle();
  if (error) throw new PaymentError("payment_storage_error");
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) return null;
  const { data: draft, error: draftError } = await admin.from("customer_payment_intakes")
    .select("payment_request_id, completed_at, review_required").eq("customer_intake_link_id", link.id).maybeSingle();
  if (draftError) throw new PaymentError("payment_storage_error");
  if (!draft) return null;
  const request = await createPaymentStore().get(draft.payment_request_id);
  if (!request || request.purpose !== "initial_fee" || !currentAccount(request)) return null;
  return {
    purpose: "initial_fee", description: "", vehicleRegistration: null, amountIsk: request.amountIsk,
    status: request.status, checkoutUrl: await checkoutAllowedForJob(request) ? safeCheckoutUrl(request) : null,
    intakeState: draft.completed_at ? "submitted" : draft.review_required ? "review_required" : "pending",
  };
}

/** Used to allow corrections after the original initial fee has already been paid. */
export async function hasPaidInitialForIntake(token: string) {
  if (!customerTokenSchema.safeParse(token).success) return false;
  const config = requireReconciliationConfig();
  const admin = createAdminClient();
  const { data: link, error } = await admin.from("customer_intake_links")
    .select("job_id, expires_at, revoked_at, submitted_at").eq("token_hash", hashCustomerIntakeToken(token)).maybeSingle();
  if (error) throw new PaymentError("payment_storage_error");
  if (!link || link.revoked_at || link.submitted_at || new Date(link.expires_at).getTime() <= Date.now()) return false;
  const { data, error: paymentError } = await admin.from("job_payment_requests").select("id")
    .eq("job_id", link.job_id).eq("purpose", "initial_fee").eq("environment", config.environment)
    .eq("merchant_id", config.clientId).eq("provider_api", "rest_v1_1").eq("status", "paid").maybeSingle();
  if (paymentError) throw new PaymentError("payment_storage_error");
  return Boolean(data);
}

export async function getServicePaymentSummary(token: string): Promise<PublicPaymentSummary | null> {
  if (!isCollectionEnabled() || !customerTokenSchema.safeParse(token).success) return null;
  const admin = createAdminClient();
  const { data: page, error } = await admin.from("job_payment_pages")
    .select("payment_request_id, description, vehicle_registration, expires_at")
    .eq("token_hash", hashCustomerIntakeToken(token)).maybeSingle();
  if (error) throw new PaymentError("payment_storage_error");
  if (!page || new Date(page.expires_at).getTime() <= Date.now()) return null;
  const request = await createPaymentStore().get(page.payment_request_id);
  if (!request || request.purpose !== "service" || !currentAccount(request)) return null;
  return { purpose: "service", description: page.description, vehicleRegistration: page.vehicle_registration,
    amountIsk: request.amountIsk, status: request.status, checkoutUrl: await checkoutAllowedForJob(request) ? safeCheckoutUrl(request) : null, intakeState: null };
}
