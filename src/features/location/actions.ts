"use server";

import { z } from "zod";

import { getVerifiedSession } from "@/lib/auth/session";
import type { ActionResult, LocationSuggestion } from "@/lib/domain/types";
import { toIcelandLocationSuggestion, type MapboxResponse } from "./mapbox";

const querySchema = z.string().trim().min(2).max(256).refine(
  (value) => !value.includes(";"),
  "Leitin má ekki innihalda semíkommu.",
);

export async function searchIcelandLocationsAction(
  input: unknown,
): Promise<ActionResult<LocationSuggestion[]>> {
  if (!(await getVerifiedSession())) {
    return { ok: false, error: "Innskráning rann út. Skráðu þig inn aftur." };
  }

  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sláðu inn gilt heimilisfang eða staðarheiti." };

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "Mapbox-lykill vantar fyrir staðaleit." };

  const parameters = new URLSearchParams({
    q: parsed.data,
    access_token: token,
    country: "is",
    bbox: "-24.8,63.2,-13.0,66.7",
    language: "is,en",
    limit: "5",
    permanent: "true",
  });

  try {
    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${parameters}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json() as MapboxResponse;

    if (!response.ok) {
      return { ok: false, error: payload.message ?? "Staðaleitin svaraði ekki." };
    }

    const suggestions = (payload.features ?? [])
      .map(toIcelandLocationSuggestion)
      .filter((suggestion): suggestion is LocationSuggestion => suggestion !== null);

    if (suggestions.length === 0) {
      return { ok: false, error: "Enginn staður fannst á Íslandi. Prófaðu nákvæmara heiti." };
    }

    return { ok: true, data: suggestions };
  } catch {
    return { ok: false, error: "Ekki náðist samband við staðaleitina. Reyndu aftur." };
  }
}
