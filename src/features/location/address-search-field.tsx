"use client";

import { Check, MapPin, MousePointer2, Search } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { KeyboardEvent, useEffect, useRef, useState, useTransition } from "react";

import type { LocationSource, LocationSuggestion } from "@/lib/domain/types";
import { searchIcelandLocationsAction } from "./actions";

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
  mapboxAccessToken?: string | null;
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
  mapboxAccessToken,
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

  function search() {
    setError(null);
    setSuggestions([]);
    startTransition(async () => {
      const result = await searchIcelandLocationsAction(query);
      if (!result.ok || !result.data) {
        setError(result.error ?? "Staður fannst ekki.");
        return;
      }
      setSuggestions(result.data);
    });
  }

  function selectSuggestion(suggestion: LocationSuggestion) {
    setSelected(suggestion);
    setQuery(suggestion.label);
    setSuggestions([]);
    setError(null);
    setSource("search");
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
        <p className="address-confirmed"><Check size={14} /> Staðsetning staðfest {source === "map_pin" ? "með pinna" : "í leit"}</p>
      ) : null}
      {error ? <p className="compact-error" role="alert">{error}</p> : null}

      {mapboxAccessToken ? (
        <div className="map-picker-section">
          <button className="map-picker-toggle" type="button" onClick={() => setShowMapPicker((visible) => !visible)}>
            <MousePointer2 size={14} /> {showMapPicker ? "Loka kortavali" : "Eða velja nákvæman stað á korti"}
          </button>
          {showMapPicker ? (
            <LocationPinMap
              accessToken={mapboxAccessToken}
              latitude={selected?.latitude}
              longitude={selected?.longitude}
              onPick={(latitude, longitude) => {
                const pinLabel = `Pinni á korti · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                setSelected({ id: "map-pin", label: pinLabel, latitude, longitude });
                setQuery(pinLabel);
                setSource("map_pin");
                setSuggestions([]);
                setError(null);
              }}
            />
          ) : null}
        </div>
      ) : null}

      <input name={locationLabelName} type="hidden" value={selected?.label ?? ""} readOnly required />
      <input name={latitudeName} type="hidden" value={selected?.latitude ?? ""} readOnly required />
      <input name={longitudeName} type="hidden" value={selected?.longitude ?? ""} readOnly required />
      {locationSourceName ? <input name={locationSourceName} type="hidden" value={source} readOnly /> : null}
    </div>
  );
}

function LocationPinMap({
  accessToken,
  latitude,
  longitude,
  onPick,
}: {
  accessToken: string;
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
    const map = new mapboxgl.Map({
      accessToken,
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: hasLocation ? [longitude, latitude] : [-18.7, 64.95],
      zoom: hasLocation ? 10 : 5.25,
      maxBounds: [[-27.8, 62.1], [-10.1, 68.1]],
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    let marker: mapboxgl.Marker | null = hasLocation
      ? new mapboxgl.Marker({ color: "#0e4b46", draggable: true }).setLngLat([longitude, latitude]).addTo(map)
      : null;

    const pick = (lng: number, lat: number) => {
      if (!marker) {
        marker = new mapboxgl.Marker({ color: "#0e4b46", draggable: true }).setLngLat([lng, lat]).addTo(map);
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
  }, [accessToken, latitude, longitude]);

  return <div className="location-pin-map" aria-label="Veldu stað með pinna á korti" ref={containerRef} />;
}
