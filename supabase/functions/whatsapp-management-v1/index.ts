import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";

import {
  ensureOperationalMessageTemplates,
  ensureMessagesWebhookSubscription,
  inspectWhatsAppBusinessAccount,
  MetaConfigurationError,
} from "../_shared/whatsapp-management.ts";

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
  ) {
    super(code);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown) {
  if (
    !isRecord(value)
    || Object.keys(value).length !== 1
    || (
      value.action !== "ensure_messages_subscription"
      && value.action !== "ensure_operational_templates"
      && value.action !== "inspect_production_account"
    )
  ) {
    throw new FunctionFailure(400, "invalid_request");
  }

  return { action: value.action } as const;
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new FunctionFailure(500, "configuration_error");
  return value;
}

function numericId(name: string) {
  const value = requiredEnvironment(name);
  if (!/^\d+$/.test(value)) throw new FunctionFailure(500, "configuration_error");
  return value;
}

function graphApiVersion() {
  const value = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") ?? "v25.0";
  if (!/^v\d+\.\d+$/.test(value)) throw new FunctionFailure(500, "configuration_error");
  return value;
}

async function requireStaff(caller: SupabaseClient) {
  const { data, error } = await caller.rpc("is_staff");
  if (error || data !== true) throw new FunctionFailure(403, "staff_access_required");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (request.method !== "POST") return json({ error: { code: "method_not_allowed" } }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new FunctionFailure(401, "authentication_required");
    }

    const input = parseRequest(await request.json().catch(() => null));

    const supabaseUrl = requiredEnvironment("SUPABASE_URL").replace(/\/$/, "");
    const caller = createClient(
      supabaseUrl,
      requiredEnvironment("SUPABASE_ANON_KEY"),
      {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
        global: { headers: { Authorization: authorization } },
      },
    );

    // A valid Supabase session can belong to a driver. Meta configuration is
    // restricted to dispatch staff before any protected credential is used.
    await requireStaff(caller);

    const accessToken = requiredEnvironment("WHATSAPP_ACCESS_TOKEN");
    const version = graphApiVersion();
    const data = input.action === "inspect_production_account"
      ? await inspectWhatsAppBusinessAccount({
        accessToken,
        graphApiVersion: version,
        wabaId: numericId("WHATSAPP_PRODUCTION_BUSINESS_ACCOUNT_ID"),
      })
      : input.action === "ensure_operational_templates"
        ? await ensureOperationalMessageTemplates({
          accessToken,
          graphApiVersion: version,
          wabaId: numericId("WHATSAPP_BUSINESS_ACCOUNT_ID"),
        })
        : await ensureMessagesWebhookSubscription({
        accessToken,
        appId: numericId("WHATSAPP_APP_ID"),
        appSecret: requiredEnvironment("WHATSAPP_APP_SECRET"),
        callbackUrl: `${supabaseUrl}/functions/v1/whatsapp-webhook-v1`,
        graphApiVersion: version,
        verifyToken: requiredEnvironment("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
        wabaId: numericId("WHATSAPP_BUSINESS_ACCOUNT_ID"),
      });

    return json({ data });
  } catch (error) {
    if (error instanceof FunctionFailure) {
      return json({ error: { code: error.code } }, error.status);
    }

    if (error instanceof MetaConfigurationError) {
      console.error(
        `whatsapp-management-v1 Meta request rejected: status=${error.status} code=${error.metaCode ?? "unknown"}`,
      );
      return json({
        error: {
          code: error.code,
          metaCode: error.metaCode,
        },
      }, 502);
    }

    console.error("whatsapp-management-v1 unexpected failure");
    return json({ error: { code: "internal_error" } }, 500);
  }
});
