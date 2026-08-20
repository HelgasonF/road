"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import { createIcelandMapStyle, ICELAND_MAX_BOUNDS } from "@/features/location/map-style";

interface CustomerLocationMapProps {
  latitude: number;
  longitude: number;
  onPick: (latitude: number, longitude: number) => void;
}

export function CustomerLocationMap({ latitude, longitude, onPick }: CustomerLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createIcelandMapStyle(),
      center: [longitude, latitude],
      zoom: 10,
      minZoom: 4.4,
      maxBounds: ICELAND_MAX_BOUNDS,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    const marker = new maplibregl.Marker({ color: "#0e4b46", draggable: true })
      .setLngLat([longitude, latitude])
      .addTo(map);
    marker.on("dragend", () => {
      const position = marker.getLngLat();
      onPickRef.current(position.lat, position.lng);
    });
    map.on("click", (event) => onPickRef.current(event.lngLat.lat, event.lngLat.lng));

    markerRef.current = marker;
    mapRef.current = map;
    return () => {
      marker.remove();
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
    // The first coordinates establish the map. Later changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const coordinate: [number, number] = [longitude, latitude];
    markerRef.current?.setLngLat(coordinate);
    mapRef.current?.easeTo({ center: coordinate, duration: 350 });
  }, [latitude, longitude]);

  return <div className="customer-location-map" ref={containerRef} aria-label="Choose location on map" />;
}
