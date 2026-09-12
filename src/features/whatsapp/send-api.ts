import "server-only";

import { FunctionsHttpError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export type WhatsAppTemplatePurpose =
  | "customer_intake"
  | "driver_availability"
  | "driver_assignment"
  | "test";

export interface WhatsAppTemplateRequest {
  action: "send_template";
  bodyParameters?: string[];
  buttonUrlSuffix?: string;
  customerIntakeLinkId?: string;
  idempotencyKey: string;
  jobId?: string;
  operatorId?: string;
  purpose: WhatsAppTemplatePurpose;
  recipientPhone: string;
}

export interface WhatsAppSendReceipt {
  deduplicated: boolean;
  messageId: string;
  metaMessageId: string;
  state: "accepted" | "sent" | "delivered" | "read";
}

export type WhatsAppSendResult =
  | { ok: true; data: WhatsAppSendReceipt }
  | { ok: false; errorCode: string };

const whatsappErrors: Record<string, string> = {
  authentication_required: "Innskráning rann út. Skráðu þig inn aftur.",
  configuration_error: "WhatsApp-sniðmátið er ekki tilbúið. Notaðu handvirka sendingu.",
  delivery_unknown: "Óvíst er hvort WhatsApp tók við skilaboðunum. Athugaðu stöðuna áður en þú reynir aftur.",
  recipient_opted_out: "Viðtakandinn hefur afþakkað WhatsApp-skilaboð. Notaðu símtal eða aðra samþykkta leið.",
  staff_access_required: "Aðeins starfsfólk getur sent WhatsApp-skilaboð.",
  whatsapp_provider_rejected: "WhatsApp hafnaði sjálfvirku sendingunni. Notaðu handvirka sendingu.",
};

export function getWhatsAppSendError(code: string) {
  return whatsappErrors[code] ?? "Sjálfvirk WhatsApp-sending mistókst. Notaðu handvirka sendingu.";
}

async function readFunctionErrorCode(error: unknown) {
  if (!(error instanceof FunctionsHttpError)) return "function_unavailable";

  try {
    const body = await error.context.json() as unknown;
    if (
      typeof body === "object"
      && body !== null
      && "error" in body
      && typeof body.error === "object"
      && body.error !== null
      && "code" in body.error
      && typeof body.error.code === "string"
    ) {
      return body.error.code;
    }
  } catch {
    // Callers receive a stable fallback when the function response is not JSON.
  }

  return "function_unavailable";
}

export async function invokeWhatsAppSendFunction(
  input: WhatsAppTemplateRequest,
): Promise<WhatsAppSendResult> {
  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) return { ok: false, errorCode: "authentication_required" };

  const { data, error } = await supabase.functions.invoke<{ data?: WhatsAppSendReceipt }>(
    "whatsapp-send-v1",
    {
      body: input,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (error) return { ok: false, errorCode: await readFunctionErrorCode(error) };
  if (!data?.data) return { ok: false, errorCode: "invalid_function_response" };
  return { ok: true, data: data.data };
}
