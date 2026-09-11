import { createClient } from "npm:@supabase/supabase-js@2.112.3";

import {
  createWhatsAppWebhookHandler,
  type WhatsAppWebhookEvent,
} from "../_shared/whatsapp-webhook.ts";

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`whatsapp-webhook-v1 configuration missing: ${name}`);
    throw new Error("Webhook configuration unavailable");
  }
  return value;
}

async function persistEvent(event: WhatsAppWebhookEvent) {
  const admin = createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
  const { error } = await admin.rpc("ingest_whatsapp_webhook_event", {
    p_messages: event.messages.map((message) => ({
      context_message_id: message.contextMessageId,
      message_id: message.messageId,
      message_type: message.messageType,
      phone_number_id: message.phoneNumberId,
      received_at: message.occurredAt,
      reply_classification: message.replyClassification,
      sender_phone: message.senderPhone,
      text_body: message.textBody,
    })),
    p_payload: event.payload,
    p_payload_sha256: event.payloadSha256,
    p_statuses: event.statuses.map((status) => ({
      error_code: status.errorCode,
      message_id: status.messageId,
      occurred_at: status.occurredAt,
      recipient_phone: status.recipientPhone,
      status: status.status,
    })),
    p_waba_id: event.wabaId,
  });

  if (error) {
    console.error(`whatsapp-webhook-v1 persistence failed: ${error.code}`);
    throw new Error("Webhook event persistence failed");
  }
}

const handler = createWhatsAppWebhookHandler({
  getVerifyToken: () => Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
  getAppSecret: () => Deno.env.get("WHATSAPP_APP_SECRET"),
  persistEvent,
});

Deno.serve(handler);
