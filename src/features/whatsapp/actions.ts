"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { invokeDriverAccessFunction } from "@/features/operators/driver-access-api";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import type { ActionResult, CapabilityCode, JobPriority } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import {
  buildDriverTemplateBodyParameters,
  encodeDriverAccessButtonCode,
  formatDriverTemplateDistance,
} from "./messages";
import {
  getWhatsAppSendError,
  invokeWhatsAppSendFunction,
  type WhatsAppSendReceipt,
} from "./send-api";

const contactSchema = z.object({
  jobId: z.uuid(),
  operatorId: z.uuid(),
});

const demoError = "Ekki er hægt að senda WhatsApp-skilaboð í sýnisham.";
const authError = "Innskráning rann út. Skráðu þig inn aftur.";

type ContactRows = {
  job: {
    id: string;
    intake_pending: boolean;
    latitude: number;
    location_label: string | null;
    longitude: number;
    priority: JobPriority;
    status: string;
    requiredCapabilities: CapabilityCode[];
  };
  operator: {
    id: string;
    is_active: boolean;
    name: string;
    phone: string;
  };
};

async function loadContactRows(jobId: string, operatorId: string): Promise<ContactRows | null> {
  const supabase = await createClient();
  const [jobResult, operatorResult, capabilitiesResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, intake_pending, latitude, longitude, location_label, priority, status")
      .eq("id", jobId)
      .maybeSingle(),
    supabase
      .from("operators")
      .select("id, is_active, name, phone")
      .eq("id", operatorId)
      .maybeSingle(),
    supabase
      .from("job_required_capabilities")
      .select("capability_code")
      .eq("job_id", jobId),
  ]);

  if (
    jobResult.error
    || operatorResult.error
    || capabilitiesResult.error
    || !jobResult.data
    || !operatorResult.data
  ) return null;
  return {
    job: {
      ...jobResult.data,
      requiredCapabilities: capabilitiesResult.data.map((item) => item.capability_code),
    },
    operator: operatorResult.data as ContactRows["operator"],
  };
}

function contactSummary(rows: ContactRows) {
  return {
    driverName: rows.operator.name,
    locationLabel: rows.job.location_label
      ?? `${rows.job.latitude.toFixed(4)}, ${rows.job.longitude.toFixed(4)}`,
    priority: rows.job.priority,
    requiredCapabilities: rows.job.requiredCapabilities,
  };
}

export async function sendDriverAvailabilityWhatsAppAction(
  input: unknown,
): Promise<ActionResult<{ receipt: WhatsAppSendReceipt }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ógilt verkefni eða þjónustuaðili." };

  const rows = await loadContactRows(parsed.data.jobId, parsed.data.operatorId);
  if (
    !rows
    || !rows.operator.is_active
    || rows.job.intake_pending
    || ["completed", "cancelled"].includes(rows.job.status)
  ) return { ok: false, error: "Verkefnið eða þjónustuaðilinn er ekki tiltækur." };

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("job_operator_matches")
    .select("distance_km")
    .eq("job_id", parsed.data.jobId)
    .eq("operator_id", parsed.data.operatorId)
    .maybeSingle();
  const distanceKm = match ? Number(match.distance_km) : null;
  const bodyParameters = [
    ...buildDriverTemplateBodyParameters(contactSummary(rows)),
    formatDriverTemplateDistance(distanceKm),
  ];
  const result = await invokeWhatsAppSendFunction({
    action: "send_template",
    bodyParameters,
    idempotencyKey: randomUUID(),
    jobId: parsed.data.jobId,
    operatorId: parsed.data.operatorId,
    purpose: "driver_availability",
    recipientPhone: rows.operator.phone,
  });

  if (!result.ok) return { ok: false, error: getWhatsAppSendError(result.errorCode) };
  revalidatePath("/");
  revalidatePath(`/jobs/${parsed.data.jobId}/history`);
  return { ok: true, data: { receipt: result.data } };
}

export async function createAndSendDriverAssignmentWhatsAppAction(
  input: unknown,
): Promise<ActionResult<{
  path: string;
  receipt: WhatsAppSendReceipt | null;
  sendError: string | null;
}>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: authError };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ógilt verkefni eða þjónustuaðili." };

  const rows = await loadContactRows(parsed.data.jobId, parsed.data.operatorId);
  if (!rows || !rows.operator.is_active) {
    return { ok: false, error: "Verkefnið eða þjónustuaðilinn fannst ekki." };
  }

  const link = await invokeDriverAccessFunction<{ path: string }>({
    action: "create_link",
    operatorId: parsed.data.operatorId,
  });
  if (!link.ok) return { ok: false, error: "Ekki tókst að búa til öruggan ökumannstengil." };

  const buttonUrlSuffix = encodeDriverAccessButtonCode(link.data.path);
  if (!buttonUrlSuffix) return { ok: false, error: "Ökumannstengillinn var ógildur." };

  const result = await invokeWhatsAppSendFunction({
    action: "send_template",
    bodyParameters: buildDriverTemplateBodyParameters(contactSummary(rows)),
    buttonUrlSuffix,
    idempotencyKey: randomUUID(),
    jobId: parsed.data.jobId,
    operatorId: parsed.data.operatorId,
    purpose: "driver_assignment",
    recipientPhone: rows.operator.phone,
  });

  revalidatePath("/");
  revalidatePath(`/jobs/${parsed.data.jobId}/history`);
  return {
    ok: true,
    data: {
      path: link.data.path,
      receipt: result.ok ? result.data : null,
      sendError: result.ok ? null : getWhatsAppSendError(result.errorCode),
    },
  };
}
