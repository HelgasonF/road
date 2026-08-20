"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import { createIcelandMapStyle, ICELAND_CENTER, ICELAND_MAX_BOUNDS } from "@/features/location/map-style";
import type { Job, Operator } from "@/lib/domain/types";
import { availabilityLabels, jobStatusLabels } from "@/lib/i18n/is";
import { createOperatorCoverageGeoJson, getCoverageDiameterPixels } from "./operator-coverage";

const MAX_COVERAGE_DIAMETER_PX = 6000;

function resizeOperatorCoverageMarkers(
  map: maplibregl.Map,
  markers: Map<string, maplibregl.Marker>,
) {
  markers.forEach((marker) => {
    const element = marker.getElement();
    const radiusKm = Number(element.dataset.radiusKm);
    const latitude = Number(element.dataset.latitude);
    const diameter = Math.min(
      getCoverageDiameterPixels(radiusKm, latitude, map.getZoom()),
      MAX_COVERAGE_DIAMETER_PX,
    );
    element.style.height = `${diameter}px`;
    element.style.width = `${diameter}px`;
  });
}

function updateOperatorCoverageMarkers(
  map: maplibregl.Map,
  markers: Map<string, maplibregl.Marker>,
  operators: Operator[],
  selectedOperatorId: string | null,
) {
  markers.forEach((marker) => marker.remove());
  markers.clear();

  operators.forEach((operator) => {
    const radiusKm = operator.serviceRadiusKm;
    if (!operator.isActive || radiusKm === null || !Number.isFinite(radiusKm) || radiusKm <= 0) return;

    const latitude = operator.currentLatitude ?? operator.baseLatitude;
    const longitude = operator.currentLongitude ?? operator.baseLongitude;
    const element = document.createElement("div");
    element.className = `operator-coverage-marker operator-coverage-${operator.availabilityStatus}`;
    element.classList.toggle("operator-coverage-selected", operator.id === selectedOperatorId);
    element.dataset.latitude = String(latitude);
    element.dataset.radiusKm = String(radiusKm);
    element.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = `${radiusKm} km`;
    element.append(label);

    const marker = new maplibregl.Marker({ element, anchor: "center" })
      .setLngLat([longitude, latitude])
      .addTo(map);
    markers.set(operator.id, marker);
  });

  resizeOperatorCoverageMarkers(map, markers);
}

interface IcelandMapProps {
  jobs: Job[];
  operators: Operator[];
  selectedJobId: string | null;
  selectedOperatorId: string | null;
  onSelectJob: (jobId: string) => void;
  onSelectOperator: (operatorId: string) => void;
}

export function IcelandMap({
  jobs,
  operators,
  selectedJobId,
  selectedOperatorId,
  onSelectJob,
  onSelectOperator,
}: IcelandMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const coverageMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const operatorMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const jobMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const selectOperatorRef = useRef(onSelectOperator);
  const selectJobRef = useRef(onSelectJob);
  const coverageStateRef = useRef({ operators, selectedOperatorId });

  useEffect(() => { selectOperatorRef.current = onSelectOperator; }, [onSelectOperator]);
  useEffect(() => { selectJobRef.current = onSelectJob; }, [onSelectJob]);
  useEffect(() => {
    coverageStateRef.current = { operators, selectedOperatorId };
    const map = mapRef.current;
    if (map) updateOperatorCoverageMarkers(map, coverageMarkersRef.current, operators, selectedOperatorId);
  }, [operators, selectedOperatorId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const coverageMarkers = coverageMarkersRef.current;
    const operatorMarkers = operatorMarkersRef.current;
    const jobMarkers = jobMarkersRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createIcelandMapStyle(),
      center: ICELAND_CENTER,
      zoom: 5.25,
      minZoom: 4.4,
      maxBounds: ICELAND_MAX_BOUNDS,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    const resizeCoverage = () => resizeOperatorCoverageMarkers(map, coverageMarkers);
    map.on("zoom", resizeCoverage);
    mapRef.current = map;
    {
      const state = coverageStateRef.current;
      updateOperatorCoverageMarkers(map, coverageMarkers, state.operators, state.selectedOperatorId);
    }

    return () => {
      map.off("zoom", resizeCoverage);
      coverageMarkers.forEach((marker) => marker.remove());
      operatorMarkers.forEach((marker) => marker.remove());
      jobMarkers.forEach((marker) => marker.remove());
      coverageMarkers.clear();
      operatorMarkers.clear();
      jobMarkers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    operatorMarkersRef.current.forEach((marker) => marker.remove());
    operatorMarkersRef.current.clear();

    operators.forEach((operator) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `map-marker map-marker-${operator.availabilityStatus}`;
      element.dataset.markerId = operator.id;
      element.title = `${operator.name} — ${availabilityLabels[operator.availabilityStatus]}`;
      element.setAttribute("aria-label", element.title);
      const initial = document.createElement("span");
      initial.textContent = operator.name.charAt(0);
      element.append(initial);
      element.addEventListener("click", () => selectOperatorRef.current(operator.id));

      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([operator.currentLongitude ?? operator.baseLongitude, operator.currentLatitude ?? operator.baseLatitude])
        .addTo(map);
      operatorMarkersRef.current.set(operator.id, marker);
    });
  }, [operators]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    jobMarkersRef.current.forEach((marker) => marker.remove());
    jobMarkersRef.current.clear();

    jobs.filter((job) => job.status !== "completed" && job.status !== "cancelled").forEach((job) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `job-map-marker job-priority-${job.priority}`;
      element.dataset.markerId = job.id;
      element.title = `${job.customerName} — ${jobStatusLabels[job.status]}`;
      element.setAttribute("aria-label", element.title);
      const initial = document.createElement("span");
      initial.textContent = "V";
      element.append(initial);
      element.addEventListener("click", () => selectJobRef.current(job.id));

      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([job.longitude, job.latitude])
        .addTo(map);
      jobMarkersRef.current.set(job.id, marker);
    });
  }, [jobs]);

  useEffect(() => {
    operatorMarkersRef.current.forEach((marker, id) => marker.getElement().classList.toggle("map-marker-selected", id === selectedOperatorId));
    jobMarkersRef.current.forEach((marker, id) => marker.getElement().classList.toggle("job-map-marker-selected", id === selectedJobId));
  }, [selectedJobId, selectedOperatorId, jobs, operators]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const job = jobs.find((item) => item.id === selectedJobId);
    const operator = operators.find((item) => item.id === selectedOperatorId);
    if (job) {
      map.easeTo({ center: [job.longitude, job.latitude], zoom: Math.max(map.getZoom(), 7), duration: 650 });
      return;
    }

    if (!operator) return;
    const coverage = createOperatorCoverageGeoJson([operator], operator.id).features[0];
    if (coverage) {
      const bounds = coverage.geometry.coordinates[0].reduce(
        (result, coordinate) => result.extend(coordinate as [number, number]),
        new maplibregl.LngLatBounds(),
      );
      map.fitBounds(bounds, { padding: 62, maxZoom: 8, duration: 650 });
      return;
    }

    map.easeTo({
      center: [operator.currentLongitude ?? operator.baseLongitude, operator.currentLatitude ?? operator.baseLatitude],
      zoom: Math.max(map.getZoom(), 7),
      duration: 650,
    });
  }, [jobs, operators, selectedJobId, selectedOperatorId]);

  return <div className="maplibre-container" ref={containerRef} aria-label="Kort af Íslandi" />;
}
