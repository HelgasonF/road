"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedStaffSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import {
  billingDetailsSchema,
  billingTransitionSchema,
  type BillingDetailsInput,
  type BillingTransitionInput,
} from "./schemas";

const demoError = "Ekki er hægt að vista breytingar í sýnisham.";
const authError = "Innskráning rann út. Skráðu þig inn aftur.";

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return {
    ok: false,
    error: "Farðu yfir innsláttinn og reyndu aftur.",
    fieldErrors: error.flatten().fieldErrors,
  } satisfies ActionResult;
}

function revalidateBilling(jobId: string) {
  revalidatePath("/billing");
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}/history`);
}

export async function saveBillingDetailsAction(
  input: BillingDetailsInput,
): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };

  const parsed = billingDetailsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_job_billing", {
    p_job_id: value.jobId,
    p_payer_type: value.payerType,
    p_payer_name: value.payerName,
    p_payer_kennitala: value.payerKennitala,
    p_payer_email: value.payerEmail,
    p_payer_phone: value.payerPhone,
    p_payer_address: value.payerAddress,
    p_authorization_reference: value.authorizationReference,
    p_billing_reference: value.billingReference,
    p_service_summary: value.serviceSummary,
    p_payer_amount_isk: value.payerAmountIsk,
    p_provider_amount_isk: value.providerAmountIsk,
    p_notes: value.notes,
  });

  if (error) return { ok: false, error: "Ekki tókst að vista uppgjörsupplýsingarnar." };
  revalidateBilling(value.jobId);
  return { ok: true };
}

export async function transitionBillingAction(
  input: BillingTransitionInput,
): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };

  const parsed = billingTransitionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_job_billing", {
    p_job_id: value.jobId,
    p_action: value.action,
    p_reference: value.reference,
    p_due_at: value.dueDate,
    p_notes: value.notes,
  });

  if (error) return { ok: false, error: "Ekki tókst að uppfæra greiðslustöðuna." };
  revalidateBilling(value.jobId);
  return { ok: true };
}
