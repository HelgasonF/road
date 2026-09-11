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
  const { error } = await admin
    .from("whatsapp_webhook_events")
    .upsert(
      {
        payload: event.payload,
        payload_sha256: event.payloadSha256,
        waba_id: event.wabaId,
      },
      { ignoreDuplicates: true, onConflict: "payload_sha256" },
    );

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
