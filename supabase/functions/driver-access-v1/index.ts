import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";

import {
  buildDriverAccessPath,
  getDriverAuthEmail,
  type DriverAccessTokenType,
} from "../_shared/driver-access.ts";

const jsonHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

type DriverAccessRequest =
  | { action: "create_link"; operatorId: string }
  | { action: "set_disabled"; operatorId: string; disabled: boolean };

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

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseRequest(value: unknown): DriverAccessRequest {
  if (!isRecord(value) || !isUuid(value.operatorId)) {
    throw new FunctionFailure(400, "invalid_request");
  }

  if (value.action === "create_link") {
    return { action: value.action, operatorId: value.operatorId };
  }

  if (value.action === "set_disabled" && typeof value.disabled === "boolean") {
    return {
      action: value.action,
      operatorId: value.operatorId,
      disabled: value.disabled,
    };
  }

  throw new FunctionFailure(400, "invalid_request");
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new FunctionFailure(500, "configuration_error");
  return value;
}

async function requireStaff(caller: SupabaseClient) {
  const { data, error } = await caller.rpc("is_staff");
  if (error || data !== true) throw new FunctionFailure(403, "staff_access_required");
}

async function getOperator(caller: SupabaseClient, operatorId: string) {
  const { data, error } = await caller
    .from("operators")
    .select("id, user_id, name, driver_access_disabled_at")
    .eq("id", operatorId)
    .maybeSingle();

  if (error || !data) throw new FunctionFailure(404, "operator_not_found");
  return data;
}

async function removeCreatedUser(admin: SupabaseClient, userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.error("driver-access-v1 compensation failed: delete_user");
}

async function createDriverLink(caller: SupabaseClient, admin: SupabaseClient, operatorId: string) {
  const operator = await getOperator(caller, operatorId);
  if (operator.driver_access_disabled_at) {
    throw new FunctionFailure(409, "driver_access_disabled");
  }

  const createsUser = !operator.user_id;
  let authEmail = getDriverAuthEmail(operator.id);

  if (operator.user_id) {
    const { data, error } = await admin.auth.admin.getUserById(operator.user_id);
    if (error || !data.user) throw new FunctionFailure(404, "auth_user_not_found");
    if (!data.user.email) throw new FunctionFailure(409, "auth_user_missing_identifier");
    authEmail = data.user.email;
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail,
    options: {
      data: {
        display_name: operator.name,
        operator_id: operator.id,
      },
    },
  });

  if (error || !data.user || !data.properties.hashed_token) {
    throw new FunctionFailure(502, "link_generation_failed");
  }

  const userId = data.user.id;
  const verificationType = data.properties.verification_type;
  if (verificationType !== "signup" && verificationType !== "magiclink") {
    if (createsUser) await removeCreatedUser(admin, userId);
    throw new FunctionFailure(502, "invalid_verification_type");
  }

  if (createsUser) {
    const { error: linkError } = await caller.rpc("link_driver_user", {
      p_operator_id: operator.id,
      p_user_id: userId,
    });

    if (linkError) {
      await removeCreatedUser(admin, userId);
      throw new FunctionFailure(409, "link_user_failed");
    }
  }

  const { data: updatedOperator, error: timestampError } = await caller
    .from("operators")
    .update({ driver_access_link_created_at: new Date().toISOString() })
    .eq("id", operator.id)
    .select("id")
    .maybeSingle();

  if (timestampError || !updatedOperator) {
    if (createsUser) await removeCreatedUser(admin, userId);
    throw new FunctionFailure(500, "link_timestamp_failed");
  }

  return {
    path: buildDriverAccessPath(
      data.properties.hashed_token,
      verificationType as DriverAccessTokenType,
    ),
  };
}

function restoreBanDuration(previousBannedUntil: string | undefined) {
  if (!previousBannedUntil) return "none";
  const remainingSeconds = Math.ceil((new Date(previousBannedUntil).getTime() - Date.now()) / 1000);
  return remainingSeconds > 0 ? `${remainingSeconds}s` : "none";
}

async function setDriverAccessDisabled(
  caller: SupabaseClient,
  admin: SupabaseClient,
  operatorId: string,
  disabled: boolean,
) {
  const operator = await getOperator(caller, operatorId);
  if (!operator.user_id) throw new FunctionFailure(409, "driver_access_not_linked");

  const { data: existingUser, error: userError } = await admin.auth.admin.getUserById(operator.user_id);
  if (userError || !existingUser.user) throw new FunctionFailure(404, "auth_user_not_found");

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(operator.user_id, {
    ban_duration: disabled ? "876000h" : "none",
  });
  if (authUpdateError) throw new FunctionFailure(502, "auth_access_update_failed");

  const { error: stateError } = await caller.rpc("set_driver_access_disabled", {
    p_operator_id: operator.id,
    p_disabled: disabled,
  });

  if (stateError) {
    const { error: rollbackError } = await admin.auth.admin.updateUserById(operator.user_id, {
      ban_duration: restoreBanDuration(existingUser.user.banned_until),
    });
    if (rollbackError) console.error("driver-access-v1 compensation failed: restore_ban");
    throw new FunctionFailure(500, "access_state_update_failed");
  }

  return { disabled };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (request.method !== "POST") return json({ error: { code: "method_not_allowed" } }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new FunctionFailure(401, "authentication_required");
    }

    const supabaseUrl = requiredEnvironment("SUPABASE_URL");
    const publishableKey = requiredEnvironment("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    const input = parseRequest(await request.json().catch(() => null));

    const caller = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });

    // This must run before every service-role Auth call. A valid JWT can also
    // belong to a driver, and authentication alone does not grant staff access.
    await requireStaff(caller);

    const data = input.action === "create_link"
      ? await createDriverLink(caller, admin, input.operatorId)
      : await setDriverAccessDisabled(caller, admin, input.operatorId, input.disabled);

    return json({ data });
  } catch (error) {
    if (error instanceof FunctionFailure) {
      return json({ error: { code: error.code } }, error.status);
    }

    console.error("driver-access-v1 unexpected failure");
    return json({ error: { code: "internal_error" } }, 500);
  }
});
