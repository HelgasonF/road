import type { LocationSource, LocationSuggestion } from "@/lib/domain/types";

export type ResolvedLocation = LocationSuggestion & { source: LocationSource };

export function normalizeLocationQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").replace(/^(?:í|i|á|in|at)\s+/iu, "").trim();
}

function matchKey(value: string) {
  return normalizeLocationQuery(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("is");
}

export function automaticLocation(query: string, suggestions: LocationSuggestion[]) {
  const key = matchKey(query);
  const exact = suggestions.filter((item) => {
    const name = matchKey(item.label.split(" · ")[0]);
    return name === key || (item.id.startsWith("hms:") && name.startsWith(`${key},`));
  });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  return suggestions.length === 1 ? suggestions[0] : null;
}

export function resolvedSearchLocation(suggestion: LocationSuggestion, language: "en" | "is"): ResolvedLocation {
  const suffix = language === "is" ? " · Áætluð staðsetning" : " · Approximate location";
  return {
    ...suggestion,
    label: suggestion.id.startsWith("osm:") ? `${suggestion.label.slice(0, 300 - suffix.length)}${suffix}` : suggestion.label,
    source: "search",
  };
}
