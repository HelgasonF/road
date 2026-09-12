import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";

import {
  buildWhatsAppTemplatePayload,
  parseWhatsAppTemplateInput,
  payloadSha256,
  sendWhatsAppTemplate,
  WhatsAppProviderError,
  WhatsAppSendInputError,
  type WhatsAppMessagePurpose,
  type WhatsAppTemplateInput,
} from "../_shared/whatsapp-send.ts";

const jsonHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

class FunctionFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly metaCode: string | null = null,
  ) {
    super(code);
  }
}

type OutboundState =
  | "queued"
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "delivery_unknown"
  | "cancelled";

type ReservedMessage = {
  created: boolean;
  message_id: string;
  message_state: OutboundState;
  meta_message_id: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new FunctionFailure(500, "configuration_error");
  return value;
}

function numericEnvironment(name: string) {
  const value = requiredEnvironment(name);
  if (!/^\d+$/.test(value)) throw new FunctionFailure(500, "configuration_error");
  return value;
}

function graphApiVersion() {
  const value = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") ?? "v25.0";
  if (!/^v\d+\.\d+$/.test(value)) throw new FunctionFailure(500, "configuration_error");
  return value;
}

function templateConfiguration(purpose: WhatsAppMessagePurpose) {
  if (purpose === "test") return { language: "en_US", templateName: "hello_world" };

  const suffix = purpose.toLocaleUpperCase("en-US");
  const templateName = requiredEnvironment(`WHATSAPP_TEMPLATE_${suffix}`);
  const language = requiredEnvironment(`WHATSAPP_TEMPLATE_${suffix}_LANGUAGE`);
  if (
    !/^[a-z0-9_]{1,512}$/.test(templateName)
    || !/^[A-Za-z]{2,3}(_[A-Za-z]{2})?$/.test(language)
  ) throw new FunctionFailure(500, "configuration_error");

  return { language, templateName };
}

async function requireStaff(caller: SupabaseClient) {
  const { data, error } = await caller.rpc("is_staff");
  if (error || data !== true) throw new FunctionFailure(403, "staff_access_required");
}

async function reserveMessage(
  caller: SupabaseClient,
  input: WhatsAppTemplateInput,
  templateName: string,
  language: string,
  payloadHash: string,
) {
  const { data, error } = await caller.rpc("reserve_whatsapp_outbound_message", {
    p_customer_intake_link_id: input.customerIntakeLinkId,
    p_idempotency_key: input.idempotencyKey,
    p_job_id: input.jobId,
    p_operator_id: input.operatorId,
    p_payload_sha256: payloadHash,
    p_purpose: input.purpose,
    p_recipient_phone: input.recipientPhone,
    p_template_language: language,
    p_template_name: templateName,
  }).single();

  if (error || !data) {
    const optedOut = error?.code === "P0001"
      && error.message === "Recipient has opted out of WhatsApp messages";
    const code = error?.code === "23505"
      ? "idempotency_conflict"
      : optedOut
        ? "recipient_opted_out"
        : "message_reservation_failed";
    throw new FunctionFailure(error?.code === "23505" || optedOut ? 409 : 400, code);
  }
  return data as ReservedMessage;
}

async function currentMessage(admin: SupabaseClient, messageId: string) {
  const { data, error } = await admin
    .from("whatsapp_outbound_messages")
    .select("id, state, meta_message_id, last_attempt_at")
    .eq("id", messageId)
    .maybeSingle();
  if (error || !data) throw new FunctionFailure(500, "message_state_unavailable");
  return data as {
    id: string;
    state: OutboundState;
    meta_message_id: string | null;
    last_attempt_at: string | null;
  };
}

async function claimMessage(admin: SupabaseClient, messageId: string, payloadHash: string) {
  const { data, error } = await admin.rpc("claim_whatsapp_outbound_message", {
    p_message_id: messageId,
    p_payload_sha256: payloadHash,
  });
  if (error || typeof data !== "boolean") {
    throw new FunctionFailure(500, "message_claim_failed");
  }
  return data;
}

async function markProviderFailure(
  admin: SupabaseClient,
  messageId: string,
  error: WhatsAppProviderError,
) {
  const state = error.deliveryUnknown ? "delivery_unknown" : "failed";
  const failureCode = error.metaCode
    ?? (error.status > 0 ? `http_${error.status}` : "network_error");
  const { error: updateError } = await admin
    .from("whatsapp_outbound_messages")
    .update({ failure_code: failureCode, state, updated_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("state", "sending");
  if (updateError) console.error("whatsapp-send-v1 failed to persist provider rejection");
}

async function markAccepted(admin: SupabaseClient, messageId: string, metaMessageId: string) {
  const { data, error } = await admin.rpc("accept_whatsapp_outbound_message", {
    p_message_id: messageId,
    p_meta_message_id: metaMessageId,
  });
  if (error || data !== true) throw new FunctionFailure(503, "acceptance_persistence_failed");
}

function existingMessageResponse(message: Awaited<ReturnType<typeof currentMessage>>) {
  if (["accepted", "sent", "delivered", "read"].includes(message.state)) {
    return json({
      data: {
        deduplicated: true,
        messageId: message.id,
        metaMessageId: message.meta_message_id,
        state: message.state,
      },
    });
  }

  if (message.state === "sending") {
    const attemptAgeMs = message.last_attempt_at
      ? Date.now() - new Date(message.last_attempt_at).getTime()
      : Number.POSITIVE_INFINITY;
    if (attemptAgeMs >= 120_000) {
      return json({
        error: { code: "delivery_review_required" },
        data: { messageId: message.id, requiresReview: true, state: message.state },
      }, 409);
    }
    return json({ data: { inProgress: true, messageId: message.id, state: message.state } }, 202);
  }

  if (message.state === "delivery_unknown") {
    return json({
      error: { code: "delivery_unknown" },
      data: { messageId: message.id, requiresReview: true, state: message.state },
    }, 409);
  }

  return json({ error: { code: "message_not_sendable" } }, 409);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (request.method !== "POST") return json({ error: { code: "method_not_allowed" } }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new FunctionFailure(401, "authentication_required");
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > 32_768) {
      throw new FunctionFailure(413, "payload_too_large");
    }

    const input = parseWhatsAppTemplateInput(await request.json().catch(() => null));
    const supabaseUrl = requiredEnvironment("SUPABASE_URL");
    const caller = createClient(supabaseUrl, requiredEnvironment("SUPABASE_ANON_KEY"), {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    await requireStaff(caller);

    const admin = createClient(supabaseUrl, requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const template = templateConfiguration(input.purpose);
    const payload = buildWhatsAppTemplatePayload(input, template);
    const payloadHash = await payloadSha256(payload);
    const providerConfig = {
      accessToken: requiredEnvironment("WHATSAPP_ACCESS_TOKEN"),
      graphApiVersion: graphApiVersion(),
      language: template.language,
      phoneNumberId: numericEnvironment("WHATSAPP_PHONE_NUMBER_ID"),
      templateName: template.templateName,
    };
    const reserved = await reserveMessage(
      caller,
      input,
      template.templateName,
      template.language,
      payloadHash,
    );

    if (!reserved.created && !["queued", "failed"].includes(reserved.message_state)) {
      return existingMessageResponse(await currentMessage(admin, reserved.message_id));
    }

    if (!(await claimMessage(admin, reserved.message_id, payloadHash))) {
      return existingMessageResponse(await currentMessage(admin, reserved.message_id));
    }

    try {
      const sent = await sendWhatsAppTemplate(providerConfig, payload);
      await markAccepted(admin, reserved.message_id, sent.messageId);
      return json({
        data: {
          deduplicated: false,
          messageId: reserved.message_id,
          metaMessageId: sent.messageId,
          state: "accepted",
        },
      });
    } catch (error) {
      if (error instanceof WhatsAppProviderError) {
        await markProviderFailure(admin, reserved.message_id, error);
        throw new FunctionFailure(
          502,
          error.deliveryUnknown ? "delivery_unknown" : error.code,
          error.metaCode,
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof WhatsAppSendInputError) {
      return json({ error: { code: error.code } }, 400);
    }

    if (error instanceof FunctionFailure) {
      return json({
        error: {
          code: error.code,
          ...(error.metaCode ? { metaCode: error.metaCode } : {}),
        },
      }, error.status);
    }

    console.error("whatsapp-send-v1 unexpected failure");
    return json({ error: { code: "internal_error" } }, 500);
  }
});
