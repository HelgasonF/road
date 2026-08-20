"use server";

import { z } from "zod";

import { getVerifiedStaffSession } from "@/lib/auth/session";
import type { ActionResult, LocationSuggestion } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { toLocationSuggestion } from "./hms";

const querySchema = z.string().trim().min(2).max(256);

export async function searchIcelandLocationsAction(
  input: unknown,
): Promise<ActionResult<LocationSuggestion[]>> {
  if (!(await getVerifiedStaffSession())) {
    return { ok: false, error: "Innskráning rann út. Skráðu þig inn aftur." };
  }

  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sláðu inn gilt heimilisfang eða staðarheiti." };

  try {
    const client = await createClient();
    const { data, error } = await client.rpc("search_iceland_addresses", {
      p_query: parsed.data,
      p_limit: 8,
    });

    if (error) {
      console.error("HMS address search failed", error);
      return { ok: false, error: "Ekki tókst að leita í íslensku staðfangaskránni." };
    }

    const suggestions = (data ?? [])
      .map(toLocationSuggestion)
      .filter((suggestion): suggestion is LocationSuggestion => suggestion !== null);

    if (suggestions.length === 0) {
      return { ok: false, error: "Ekkert staðfang fannst. Prófaðu nákvæmara heiti eða veldu stað á kortinu." };
    }

    return { ok: true, data: suggestions };
  } catch {
    return { ok: false, error: "Ekki náðist samband við íslensku staðfangaskrána. Reyndu aftur." };
  }
}
