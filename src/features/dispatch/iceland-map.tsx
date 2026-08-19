"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

import type { Job, Operator } from "@/lib/domain/types";
import { availabilityLabels, is, jobStatusLabels } from "@/lib/i18n/is";

interface IcelandMapProps {
  accessToken: string | null;
  jobs: Job[];
  operators: Operator[];
  selectedJobId: string | null;
  selectedOperatorId: string | null;
  onSelectJob: (jobId: string) => void;
  onSelectOperator: (operatorId: string) => void;
}

const fallbackPositions: Record<string, { left: string; top: string }> = {
  "10000000-0000-4000-8000-000000000001": { left: "43%", top: "71%" },
  "10000000-0000-4000-8000-000000000002": { left: "51%", top: "28%" },
  "10000000-0000-4000-8000-000000000003": { left: "20%", top: "31%" },
  "10000000-0000-4000-8000-000000000004": { left: "79%", top: "46%" },
};

function MapFallback({ jobs, operators, selectedJobId, selectedOperatorId, onSelectJob, onSelectOperator }: Omit<IcelandMapProps, "accessToken">) {
  return (
    <div className="map-fallback">
      <div className="iceland-silhouette" aria-hidden="true" />
      {operators.map((operator, index) => {
        const position = fallbackPositions[operator.id] ?? { left: `${25 + ((index * 17) % 58)}%`, top: `${25 + ((index * 13) % 48)}%` };
        return (
          <button
            key={operator.id}
            className={`map-marker map-marker-${operator.availabilityStatus} ${selectedOperatorId === operator.id ? "map-marker-selected" : ""}`}
            style={position}
            type="button"
            title={`${operator.name} — ${availabilityLabels[operator.availabilityStatus]}`}
            onClick={() => onSelectOperator(operator.id)}
          ><span>{operator.name.charAt(0)}</span></button>
        );
      })}
      {jobs.map((job, index) => (
        <button
          key={job.id}
          className={`job-map-marker job-priority-${job.priority} ${selectedJobId === job.id ? "job-map-marker-selected" : ""}`}
          style={{ left: `${35 + ((index * 19) % 40)}%`, top: `${38 + ((index * 17) % 34)}%` }}
          type="button"
          title={`${job.customerName} — ${jobStatusLabels[job.status]}`}
          onClick={() => onSelectJob(job.id)}
        ><span>V</span></button>
      ))}
      <div className="map-token-notice"><strong>{is.mapTokenMissing}</strong><span>{is.mapTokenHelp}</span></div>
    </div>
  );
}

export function IcelandMap({
  accessToken,
  jobs,
  operators,
  selectedJobId,
  selectedOperatorId,
  onSelectJob,
  onSelectOperator,
}: IcelandMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const operatorMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const jobMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const selectOperatorRef = useRef(onSelectOperator);
  const selectJobRef = useRef(onSelectJob);

  useEffect(() => { selectOperatorRef.current = onSelectOperator; }, [onSelectOperator]);
  useEffect(() => { selectJobRef.current = onSelectJob; }, [onSelectJob]);

  useEffect(() => {
    if (!accessToken || !containerRef.current || mapRef.current) return;
    const operatorMarkers = operatorMarkersRef.current;
    const jobMarkers = jobMarkersRef.current;
    const map = new mapboxgl.Map({
      accessToken,
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [-18.7, 64.95],
      zoom: 5.25,
      minZoom: 4.4,
      maxBounds: [[-27.8, 62.1], [-10.1, 68.1]],
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;

    return () => {
      operatorMarkers.forEach((marker) => marker.remove());
      jobMarkers.forEach((marker) => marker.remove());
      operatorMarkers.clear();
      jobMarkers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken]);

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

      const marker = new mapboxgl.Marker({ element, anchor: "center" })
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

      const marker = new mapboxgl.Marker({ element, anchor: "center" })
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
    const center = job
      ? [job.longitude, job.latitude] as [number, number]
      : operator
        ? [operator.currentLongitude ?? operator.baseLongitude, operator.currentLatitude ?? operator.baseLatitude] as [number, number]
        : null;
    if (center) map.easeTo({ center, zoom: Math.max(map.getZoom(), 7), duration: 650 });
  }, [jobs, operators, selectedJobId, selectedOperatorId]);

  if (!accessToken) return <MapFallback jobs={jobs} operators={operators} selectedJobId={selectedJobId} selectedOperatorId={selectedOperatorId} onSelectJob={onSelectJob} onSelectOperator={onSelectOperator} />;
  return <div className="mapbox-container" ref={containerRef} aria-label="Kort af Íslandi" />;
}
