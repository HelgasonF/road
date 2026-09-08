import "server-only";

import { FunctionsHttpError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

type DriverAccessRequest =
  | { action: "create_link"; operatorId: string }
  | { action: "set_disabled"; operatorId: string; disabled: boolean };

type DriverAccessResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: string };

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
    // The caller receives a stable fallback when the function returned a non-JSON failure.
  }

  return "function_unavailable";
}

export async function invokeDriverAccessFunction<T>(
  input: DriverAccessRequest,
): Promise<DriverAccessResult<T>> {
  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) return { ok: false, errorCode: "authentication_required" };

  const { data, error } = await supabase.functions.invoke<{ data?: T }>("driver-access-v1", {
    body: input,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) return { ok: false, errorCode: await readFunctionErrorCode(error) };
  if (!data?.data) return { ok: false, errorCode: "invalid_function_response" };
  return { ok: true, data: data.data };
}

