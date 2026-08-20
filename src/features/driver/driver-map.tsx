"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import { createIcelandMapStyle, ICELAND_MAX_BOUNDS } from "@/features/location/map-style";

interface DriverMapProps {
  latitude: number;
  locationLabel: string;
  longitude: number;
}

export function DriverMap({ latitude, locationLabel, longitude }: DriverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialCoordinateRef = useRef<[number, number]>([longitude, latitude]);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initialCoordinate = initialCoordinateRef.current;

    const markerElement = document.createElement("div");
    markerElement.className = "driver-incident-marker";
    markerElement.setAttribute("aria-hidden", "true");
    const markerPin = document.createElement("span");
    markerElement.append(markerPin);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createIcelandMapStyle(),
      center: initialCoordinate,
      zoom: 11,
      minZoom: 4.4,
      maxBounds: ICELAND_MAX_BOUNDS,
      attributionControl: false,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    markerRef.current = new maplibregl.Marker({ element: markerElement, anchor: "bottom" })
      .setLngLat(initialCoordinate)
      .addTo(map);
    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    marker.setLngLat([longitude, latitude]);
    marker.getElement().title = `Viðskiptavinur: ${locationLabel}`;
    map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 11), duration: 500 });
  }, [latitude, locationLabel, longitude]);

  return (
    <div
      className="driver-job-map"
      ref={containerRef}
      role="region"
      aria-label={`Kort sem sýnir staðsetningu viðskiptavinar við ${locationLabel}`}
    />
  );
}
