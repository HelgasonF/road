"use client";

import { Check, MapPin, MousePointer2, Search } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import { KeyboardEvent, useEffect, useRef, useState, useTransition } from "react";

import type { LocationSource, LocationSuggestion } from "@/lib/domain/types";
import { findNearestIcelandAddressAction, searchIcelandLocationsAction } from "./actions";
import { createIcelandMapStyle, ICELAND_CENTER, ICELAND_MAX_BOUNDS } from "./map-style";

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
}

export function AddressSearchField({
  defaultLabel = "",
  defaultLatitude,
  defaultLongitude,
  defaultSource = "search",
  label,
  latitudeName = "latitude",
  locationSourceName,
  longitudeName = "longitude",
  locationLabelName = "locationLabel",
}: AddressSearchFieldProps) {
  const hasDefault = defaultLatitude !== undefined && defaultLongitude !== undefined && Boolean(defaultLabel);
  const [query, setQuery] = useState(defaultLabel);
  const [selected, setSelected] = useState<LocationSuggestion | null>(hasDefault ? {
    id: "saved-location",
    label: defaultLabel,
    latitude: defaultLatitude!,
    longitude: defaultLongitude!,
  } : null);
  const [source, setSource] = useState<LocationSource>(defaultSource);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pinLookupPending, startPinLookupTransition] = useTransition();
  const interactionIdRef = useRef(0);

  function search() {
    const interactionId = ++interactionIdRef.current;
    setError(null);
    setSuggestions([]);
    startTransition(async () => {
      const result = await searchIcelandLocationsAction(query);
      if (interactionId !== interactionIdRef.current) return;
      if (!result.ok || !result.data) {
        setError(result.error ?? "Staður fannst ekki.");
        return;
      }
      setSuggestions(result.data);
    });
  }

  function selectSuggestion(suggestion: LocationSuggestion) {
    interactionIdRef.current += 1;
    setSelected(suggestion);
    setQuery(suggestion.label);
    setSuggestions([]);
    setError(null);
    setSource("search");
  }

  function selectMapPin(latitude: number, longitude: number) {
    const interactionId = ++interactionIdRef.current;
    const pinLabel = `Pinni á korti · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    setSelected({ id: "map-pin", label: pinLabel, latitude, longitude });
    setQuery(pinLabel);
    setSource("map_pin");
    setSuggestions([]);
    setError(null);

    startPinLookupTransition(async () => {
      const result = await findNearestIcelandAddressAction({ latitude, longitude });
      if (interactionId !== interactionIdRef.current || !result.ok || !result.data) return;

      setSelected({ id: "map-pin", label: result.data.label, latitude, longitude });
      setQuery(result.data.label);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  }

  return (
    <div className="address-search">
      <label className="field">
        <span>{label}</span>
        <span className="address-search-input">
          <MapPin size={16} aria-hidden="true" />
          <input
            autoComplete="street-address"
            value={query}
            placeholder="T.d. Hella, Bústaðavegur 151 eða Ísafjörður"
            onChange={(event) => {
              interactionIdRef.current += 1;
              setQuery(event.target.value);
              setSelected(null);
              setSuggestions([]);
            }}
            onKeyDown={handleKeyDown}
          />
          <button type="button" onClick={search} disabled={pending || query.trim().length < 2}>
            <Search size={15} /> {pending ? "Leita…" : "Finna"}
          </button>
        </span>
      </label>

      {suggestions.length > 0 ? (
        <div className="address-results" role="listbox" aria-label="Niðurstöður staðaleitar">
          {suggestions.map((suggestion) => (
            <button key={suggestion.id} type="button" onClick={() => selectSuggestion(suggestion)}>
              <MapPin size={14} />
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <p className="address-confirmed">
          <Check size={14} /> Staðsetning staðfest {source === "map_pin" ? "með pinna" : "í leit"}
          {pinLookupPending ? " · leita að heimilisfangi…" : ""}
        </p>
      ) : null}
      {error ? <p className="compact-error" role="alert">{error}</p> : null}

      <div className="map-picker-section">
        <button className="map-picker-toggle" type="button" onClick={() => setShowMapPicker((visible) => !visible)}>
          <MousePointer2 size={14} /> {showMapPicker ? "Loka kortavali" : "Eða velja nákvæman stað á korti"}
        </button>
        {showMapPicker ? (
          <LocationPinMap
            latitude={selected?.latitude}
            longitude={selected?.longitude}
            onPick={selectMapPin}
          />
        ) : null}
      </div>

      <input name={locationLabelName} type="hidden" value={selected?.label ?? ""} readOnly required />
      <input name={latitudeName} type="hidden" value={selected?.latitude ?? ""} readOnly required />
      <input name={longitudeName} type="hidden" value={selected?.longitude ?? ""} readOnly required />
      {locationSourceName ? <input name={locationSourceName} type="hidden" value={source} readOnly /> : null}
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
