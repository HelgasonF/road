import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

// Vercel overwrites x-forwarded-for with the connecting client's address, so
// callers cannot spoof it there. Revisit this before hosting behind another proxy.
export async function requestAddress() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Counts one request against `bucket` and reports whether it is within
 * `limit` requests per `windowSeconds`. Fails open: during a roadside
 * emergency a limiter outage must not lock staff or customers out.
 */
export async function consumeRateLimit(bucket: string, limit: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data !== false;
}
