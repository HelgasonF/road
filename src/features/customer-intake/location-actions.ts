"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult, LocationSuggestion } from "@/lib/domain/types";
import { toLocationSuggestion } from "@/features/location/hms";
import { normalizeLocationQuery } from "@/features/location/typed-location";
import { customerTokenSchema } from "./schemas";
import { getActiveCustomerLinkByToken } from "./queries";
import { customerLinkRequestAllowed, customerRateLimitError } from "./rate-limit";

const inputSchema = z.object({ token: customerTokenSchema, query: z.string().trim().min(2).max(256) }).strict();

export async function searchCustomerLocationsAction(input: unknown): Promise<ActionResult<LocationSuggestion[]>> {
  if (!(await customerLinkRequestAllowed())) return { ok: false, error: customerRateLimitError };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a town or address." };
  try {
    if (!(await getActiveCustomerLinkByToken(parsed.data.token))) return { ok: false, error: "This customer link is unavailable." };
    const { data, error } = await createAdminClient().rpc("search_iceland_addresses", {
      p_query: normalizeLocationQuery(parsed.data.query), p_limit: 8,
    });
    if (error) return { ok: false, error: "Location search is temporarily unavailable. Try again or use GPS/the map." };
    return { ok: true, data: (data ?? []).map(toLocationSuggestion).filter((item): item is LocationSuggestion => item !== null) };
  } catch {
    return { ok: false, error: "Location search is temporarily unavailable. Try again or use GPS/the map." };
  }
}
