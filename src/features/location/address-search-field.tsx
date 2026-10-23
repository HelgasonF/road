"use client";

import { Check, MapPin, MousePointer2, Search } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import { useEffect, useId, useImperativeHandle, useRef, useState, useTransition, type KeyboardEvent, type Ref } from "react";

import type { ActionResult, LocationSource, LocationSuggestion } from "@/lib/domain/types";
import { findNearestIcelandAddressAction, searchIcelandLocationsAction } from "./actions";
import { createIcelandMapStyle, ICELAND_CENTER, ICELAND_MAX_BOUNDS } from "./map-style";
import { automaticLocation, normalizeLocationQuery, resolvedSearchLocation, type ResolvedLocation } from "./typed-location";

export interface AddressSearchFieldHandle {
  resolve: () => Promise<ResolvedLocation | null>;
  setLocation: (location: ResolvedLocation) => void;
  focus: () => void;
}

interface AddressSearchFieldProps {
  defaultLabel?: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
  defaultSource?: LocationSource;
  label: string;
  latitudeName?: string;
  locationSourceName?: string;
  longitudeName?: string;
  locationLabelName?: string;
  language?: "is" | "en";
  showMap?: boolean;
  error?: string;
  searchAction?: (query: string) => Promise<ActionResult<LocationSuggestion[]>>;
  onLocationChange?: (location: ResolvedLocation | null) => void;
  onQueryChange?: (query: string) => void;
  ref?: Ref<AddressSearchFieldHandle>;
}

export function AddressSearchField({
  defaultLabel = "", defaultLatitude, defaultLongitude, defaultSource = "search", label,
  latitudeName = "latitude", locationSourceName, longitudeName = "longitude", locationLabelName = "locationLabel",
  language = "is", showMap = true, error: externalError, searchAction = searchIcelandLocationsAction,
  onLocationChange, onQueryChange, ref,
}: AddressSearchFieldProps) {
  const id = useId();
  const hasDefault = defaultLatitude !== undefined && defaultLongitude !== undefined && Boolean(defaultLabel);
  const initial: ResolvedLocation | null = hasDefault ? {
    id: "saved-location", label: defaultLabel, latitude: defaultLatitude!, longitude: defaultLongitude!, source: defaultSource,
  } : null;
  const [query, setQuery] = useState(defaultLabel);
  const queryRef = useRef(defaultLabel);
  const [selected, setSelected] = useState<ResolvedLocation | null>(initial);
  const selectedRef = useRef(initial);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pinLookupPending, startPinLookupTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const interactionIdRef = useRef(0);
  useEffect(() => () => { interactionIdRef.current++; }, []);
  const requestRef = useRef<{ query: string; promise: Promise<ActionResult<LocationSuggestion[]>> } | null>(null);
  const isEnglish = language === "en";
  const unavailable = isEnglish ? "Location search is unavailable. Try again, use GPS or choose a point on the map." : "Staðaleit er ekki tiltæk. Reyndu aftur, notaðu GPS eða veldu punkt á kortinu.";

  function accept(location: ResolvedLocation) {
    interactionIdRef.current++;
    selectedRef.current = location;
    queryRef.current = location.label;
    setSelected(location);
    setQuery(location.label);
    setSuggestions([]);
    setError(null);
    setPending(false);
    onLocationChange?.(location);
  }

  async function resolve(focusError = true): Promise<ResolvedLocation | null> {
    if (selectedRef.current) return selectedRef.current;
    const currentQuery = queryRef.current;
    const normalized = normalizeLocationQuery(currentQuery);
    const interactionId = ++interactionIdRef.current;
    if (normalized.length < 2) {
      setError(isEnglish ? "Enter a town or street address, or use GPS/the map." : "Skrifaðu bæ eða heimilisfang, eða notaðu GPS/kortið.");
      if (focusError) inputRef.current?.focus();
      return null;
    }
    setPending(true);
    setError(null);
    try {
      if (requestRef.current?.query !== normalized) requestRef.current = { query: normalized, promise: searchAction(normalized) };
      const result = await requestRef.current.promise;
      if (interactionId !== interactionIdRef.current) return null;
      if (!result.ok || !result.data) {
        setError(unavailable);
      } else {
        const automatic = automaticLocation(normalized, result.data);
        if (automatic) {
          const location = resolvedSearchLocation(automatic, language);
          accept(location);
          return location;
        }
        setSuggestions(result.data);
        setError(result.data.length
          ? isEnglish ? "Choose one of the matching places below." : "Veldu einn af stöðunum sem fundust hér fyrir neðan."
          : isEnglish ? "No location found. Check the town/address or use GPS/the map." : "Staðsetning fannst ekki. Athugaðu bæ eða heimilisfang, eða notaðu GPS/kortið.");
      }
      if (focusError) inputRef.current?.focus();
      return null;
    } catch {
      if (interactionId === interactionIdRef.current) {
        setError(unavailable);
        if (focusError) inputRef.current?.focus();
      }
      return null;
    } finally {
      if (interactionId === interactionIdRef.current) { setPending(false); requestRef.current = null; }
    }
  }

  useImperativeHandle(ref, () => ({ resolve: () => resolve(), setLocation: accept, focus: () => inputRef.current?.focus() }));

  function selectMapPin(latitude: number, longitude: number) {
    const location: ResolvedLocation = { id: "map-pin", label: `Pinni á korti · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, latitude, longitude, source: "map_pin" };
    accept(location);
    const interactionId = interactionIdRef.current;
    startPinLookupTransition(async () => {
      const result = await findNearestIcelandAddressAction({ latitude, longitude });
      if (interactionId !== interactionIdRef.current || !result.ok || !result.data) return;
      accept({ ...location, label: result.data.label });
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); void resolve(); }
  }

  const visibleError = error ?? externalError;
  const approximate = selected?.source === "search" && selected.id.startsWith("osm:");
  return (
    <div className="address-search">
      <label className="field" htmlFor={id}><span>{label}</span></label>
      <span className="address-search-input">
        <MapPin size={16} aria-hidden="true" />
        <input id={id} ref={inputRef} data-field={locationLabelName} autoComplete="street-address" value={query} required maxLength={256}
          placeholder={isEnglish ? "Town or address, e.g. Keflavík" : "Bær eða heimilisfang, t.d. í Keflavík"}
          aria-invalid={visibleError ? true : undefined} aria-describedby={visibleError ? `${id}-error` : undefined}
          onChange={(event) => {
            interactionIdRef.current++;
            queryRef.current = event.target.value;
            selectedRef.current = null;
            setQuery(event.target.value); setSelected(null); setSuggestions([]); setError(null); setPending(false);
            onQueryChange?.(event.target.value); onLocationChange?.(null);
          }}
          onBlur={() => { if (!selectedRef.current && queryRef.current.trim().length >= 2) void resolve(false); }}
          onKeyDown={handleKeyDown} />
        <button type="button" onClick={() => void resolve()} disabled={pending || query.trim().length < 2}>
          <Search size={15} /> {pending ? isEnglish ? "Finding…" : "Leita…" : isEnglish ? "Find" : "Finna"}
        </button>
      </span>
      {suggestions.length > 0 ? <div className="address-results" role="group" aria-label={isEnglish ? "Matching locations" : "Niðurstöður staðaleitar"}>
        {suggestions.map((suggestion) => <button key={suggestion.id} type="button" onClick={() => accept(resolvedSearchLocation(suggestion, language))}><MapPin size={14} /><span>{suggestion.label}</span></button>)}
      </div> : null}
      {selected ? <p className="address-confirmed" role="status"><Check size={14} />{approximate
        ? isEnglish ? "Town found · approximate location" : "Staður fannst · áætluð staðsetning"
        : isEnglish ? "Location confirmed" : "Staðsetning staðfest"}{pinLookupPending ? " · …" : ""}</p> : null}
      {visibleError ? <p className="compact-error" id={`${id}-error`} role={error ? "alert" : undefined}>{visibleError}</p> : null}
      {showMap ? <div className="map-picker-section">
        <button className="map-picker-toggle" type="button" onClick={() => setShowMapPicker((visible) => !visible)}><MousePointer2 size={14} />{showMapPicker ? "Loka kortavali" : "Eða velja nákvæman stað á korti"}</button>
        {showMapPicker ? <LocationPinMap latitude={selected?.latitude} longitude={selected?.longitude} onPick={selectMapPin} /> : null}
      </div> : null}
      <input name={locationLabelName} type="hidden" value={selected?.label ?? ""} readOnly />
      <input name={latitudeName} type="hidden" value={selected?.latitude ?? ""} readOnly />
      <input name={longitudeName} type="hidden" value={selected?.longitude ?? ""} readOnly />
      {locationSourceName ? <input name={locationSourceName} type="hidden" value={selected?.source ?? "search"} readOnly /> : null}
    </div>
  );
}

function LocationPinMap({
  latitude,
  longitude,
  onPick,
}: {
  latitude?: number;
  longitude?: number;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  useEffect(() => {
    if (!containerRef.current) return;
    const hasLocation = latitude !== undefined && longitude !== undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createIcelandMapStyle(),
      center: hasLocation ? [longitude, latitude] : ICELAND_CENTER,
      zoom: hasLocation ? 10 : 5.25,
      maxBounds: ICELAND_MAX_BOUNDS,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    let marker: maplibregl.Marker | null = hasLocation
      ? new maplibregl.Marker({ color: "#0e4b46", draggable: true }).setLngLat([longitude, latitude]).addTo(map)
      : null;

    const pick = (lng: number, lat: number) => {
      if (!marker) {
        marker = new maplibregl.Marker({ color: "#0e4b46", draggable: true }).setLngLat([lng, lat]).addTo(map);
        marker.on("dragend", () => {
          const position = marker!.getLngLat();
          onPickRef.current(position.lat, position.lng);
        });
      } else {
        marker.setLngLat([lng, lat]);
      }
      onPickRef.current(lat, lng);
    };

    map.on("click", (event) => pick(event.lngLat.lng, event.lngLat.lat));
    if (marker) marker.on("dragend", () => {
      const position = marker!.getLngLat();
      onPickRef.current(position.lat, position.lng);
    });

    return () => { marker?.remove(); map.remove(); };
  }, [latitude, longitude]);

  return <div className="location-pin-map" aria-label="Veldu stað með pinna á korti" ref={containerRef} />;
}
