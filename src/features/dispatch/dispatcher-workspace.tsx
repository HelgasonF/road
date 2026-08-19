"use client";

import {
  BriefcaseBusiness,
  CircleUserRound,
  LogOut,
  MapPinned,
  Plus,
  Search,
  SlidersHorizontal,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { logoutAction } from "@/features/auth/actions";
import { JobEditor } from "@/features/jobs/editor";
import { JobDetail } from "@/features/jobs/job-detail";
import type { JobOperatorMatch } from "@/features/jobs/queries";
import { OperatorEditor, VehicleEditor } from "@/features/operators/editors";
import { OperatorDetail } from "@/features/operators/operator-detail";
import type {
  AvailabilityStatus,
  Capability,
  DispatcherIdentity,
  Job,
  Operator,
  Vehicle,
} from "@/lib/domain/types";
import { availabilityLabels, is, jobPriorityLabels, jobStatusLabels } from "@/lib/i18n/is";
import { IcelandMap } from "./iceland-map";

interface DispatcherWorkspaceProps {
  capabilities: Capability[];
  demoMode: boolean;
  identity: DispatcherIdentity;
  jobMatches: JobOperatorMatch[];
  jobs: Job[];
  mapboxAccessToken: string | null;
  operators: Operator[];
}

type StatusFilter = "all" | AvailabilityStatus;
type JobFilter = "active" | "unassigned" | "completed" | "all";
type WorkspaceMode = "jobs" | "operators";

export function DispatcherWorkspace({
  capabilities,
  demoMode,
  identity,
  jobMatches,
  jobs,
  mapboxAccessToken,
  operators,
}: DispatcherWorkspaceProps) {
  const router = useRouter();
  const [mode, setMode] = useState<WorkspaceMode>(jobs.length > 0 ? "jobs" : "operators");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [jobFilter, setJobFilter] = useState<JobFilter>("active");
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobs.find((job) => job.status !== "completed" && job.status !== "cancelled")?.id ?? null);
  const [operatorEditor, setOperatorEditor] = useState<Operator | null | undefined>(undefined);
  const [jobEditor, setJobEditor] = useState<Job | null | undefined>(undefined);
  const [vehicleEditor, setVehicleEditor] = useState<{ open: boolean; vehicle: Vehicle | null }>({ open: false, vehicle: null });

  const filteredOperators = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("is");
    return operators.filter((operator) => {
      const statusMatches = statusFilter === "all" || operator.availabilityStatus === statusFilter;
      const textMatches = !normalizedQuery || [operator.name, operator.companyName, operator.phone, operator.baseAddress]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("is").includes(normalizedQuery));
      return statusMatches && textMatches;
    });
  }, [operators, query, statusFilter]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("is");
    return jobs.filter((job) => {
      const filterMatches = jobFilter === "all"
        || (jobFilter === "active" && job.status !== "completed" && job.status !== "cancelled")
        || (jobFilter === "unassigned" && !job.assignment && job.status !== "completed" && job.status !== "cancelled")
        || (jobFilter === "completed" && (job.status === "completed" || job.status === "cancelled"));
      const textMatches = !normalizedQuery || [job.customerName, job.customerPhone, job.locationLabel, job.vehicleRegistration]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("is").includes(normalizedQuery));
      return filterMatches && textMatches;
    });
  }, [jobFilter, jobs, query]);

  const selectedOperator = operators.find((operator) => operator.id === selectedOperatorId) ?? null;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const activeCount = operators.filter((operator) => operator.isActive).length;
  const availableCount = operators.filter((operator) => operator.isActive && operator.availabilityStatus === "available").length;
  const activeJobCount = jobs.filter((job) => job.status !== "completed" && job.status !== "cancelled").length;

  function showOperators() {
    setMode("operators");
    setQuery("");
  }

  function showJobs() {
    setMode("jobs");
    setQuery("");
  }

  function selectOperator(operatorId: string) {
    setMode("operators");
    setSelectedOperatorId(operatorId);
    setSelectedJobId(null);
  }

  function selectJob(jobId: string) {
    setMode("jobs");
    setSelectedJobId(jobId);
    setSelectedOperatorId(null);
  }

  return (
    <main className="dispatch-app">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark"><MapPinned size={22} /></span><span><strong>{is.appName}</strong><small>{is.appTagline}</small></span></div>
        <div className="topbar-metrics" aria-label="Yfirlit">
          <div><UsersRound size={17} /><span><strong>{activeCount}</strong> {is.activeNetwork.toLocaleLowerCase("is")}</span></div>
          <div><span className="status-dot status-dot-available" /><span><strong>{availableCount}</strong> {is.availableNow.toLocaleLowerCase("is")}</span></div>
          <div><Wrench size={17} /><span><strong>{activeJobCount}</strong> {is.activeJobs.toLocaleLowerCase("is")}</span></div>
        </div>
        <div className="topbar-actions">
          {demoMode ? <span className="demo-badge">{is.demoMode}</span> : null}
          <div className="identity"><CircleUserRound size={26} /><span><strong>{identity.displayName}</strong><small>{identity.email}</small></span></div>
          <form action={logoutAction}><button className="icon-button" type="submit" aria-label={is.signOut} title={is.signOut}><LogOut size={18} /></button></form>
        </div>
      </header>

      <div className="workspace">
        <aside className="operator-sidebar">
          <div className="workspace-tabs" role="tablist" aria-label="Vinnusvæði">
            <button className={mode === "jobs" ? "workspace-tab-active" : ""} type="button" onClick={showJobs}><BriefcaseBusiness size={15} />{is.jobs}<b>{activeJobCount}</b></button>
            <button className={mode === "operators" ? "workspace-tab-active" : ""} type="button" onClick={showOperators}><UsersRound size={15} />{is.operators}</button>
          </div>

          <div className="sidebar-heading">
            <div><p className="eyebrow">{mode === "jobs" ? "Aðgerðastjórn" : "Netið"}</p><h1>{mode === "jobs" ? is.jobs : is.operators}</h1></div>
            <button
              className="primary-icon-button"
              type="button"
              disabled={demoMode}
              onClick={() => mode === "jobs" ? setJobEditor(null) : setOperatorEditor(null)}
              aria-label={mode === "jobs" ? is.newJob : is.newOperator}
              title={demoMode ? is.demoMode : mode === "jobs" ? is.newJob : is.newOperator}
            ><Plus size={20} /></button>
          </div>

          <label className="search-box"><Search size={17} aria-hidden="true" /><input aria-label={mode === "jobs" ? "Leita að verkefni" : is.searchOperators} placeholder={mode === "jobs" ? "Leita að viðskiptavini eða stað…" : "Leita í þjónustuneti…"} type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>

          {mode === "operators" ? (
            <>
              <div className="filter-row"><SlidersHorizontal size={15} /><select aria-label={is.availability} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">{is.allStatuses}</option>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span>{filteredOperators.length}</span></div>
              <div className="operator-list">
                {filteredOperators.map((operator) => (
                  <button className={`operator-row ${selectedOperatorId === operator.id ? "operator-row-selected" : ""}`} key={operator.id} type="button" onClick={() => selectOperator(operator.id)}>
                    <span className="operator-avatar">{operator.name.charAt(0)}</span><span className="operator-row-copy"><strong>{operator.name}</strong><small>{operator.companyName ?? operator.phone}</small><span><i className={`status-dot status-dot-${operator.availabilityStatus}`} />{availabilityLabels[operator.availabilityStatus]}<b>·</b>{operator.vehicles.length} ökutæki</span></span>
                  </button>
                ))}
                {filteredOperators.length === 0 ? <p className="list-empty">{is.noOperators}</p> : null}
              </div>
            </>
          ) : (
            <>
              <div className="filter-row"><SlidersHorizontal size={15} /><select aria-label="Sía verkefni" value={jobFilter} onChange={(event) => setJobFilter(event.target.value as JobFilter)}><option value="active">Virk verkefni</option><option value="unassigned">Óúthlutað</option><option value="completed">Lokið / hætt við</option><option value="all">Öll verkefni</option></select><span>{filteredJobs.length}</span></div>
              <div className="operator-list job-list">
                {filteredJobs.map((job) => (
                  <button className={`job-row ${selectedJobId === job.id ? "job-row-selected" : ""}`} key={job.id} type="button" onClick={() => selectJob(job.id)}>
                    <span className={`job-row-icon job-priority-${job.priority}`}><BriefcaseBusiness size={16} /></span>
                    <span className="operator-row-copy"><strong>{job.customerName}</strong><small>{job.locationLabel}</small><span><i className={`job-status-dot job-status-${job.status}`} />{jobStatusLabels[job.status]}<b>·</b>{jobPriorityLabels[job.priority]}</span></span>
                  </button>
                ))}
                {filteredJobs.length === 0 ? <p className="list-empty">{is.noJobs}<br /><button className="inline-create-button" type="button" disabled={demoMode} onClick={() => setJobEditor(null)}>{is.newJob}</button></p> : null}
              </div>
            </>
          )}
        </aside>

        <section className="map-panel">
          <IcelandMap
            accessToken={mapboxAccessToken}
            jobs={jobs}
            operators={operators}
            selectedJobId={selectedJobId}
            selectedOperatorId={selectedOperatorId}
            onSelectJob={selectJob}
            onSelectOperator={selectOperator}
          />
          <div className="map-legend"><span><i className="job-legend-dot" />Verkefni</span>{(["available", "busy", "offline"] as const).map((status) => <span key={status}><i className={`status-dot status-dot-${status}`} />{availabilityLabels[status]}</span>)}</div>
        </section>

        {mode === "jobs" ? (
          <JobDetail
            key={`${selectedJob?.id ?? "empty"}-${selectedJob?.status ?? "none"}-${selectedJob?.assignment?.id ?? "none"}`}
            demoMode={demoMode}
            job={selectedJob}
            matches={jobMatches}
            operators={operators}
            onEdit={() => setJobEditor(selectedJob)}
            onChanged={() => router.refresh()}
          />
        ) : (
          <OperatorDetail
            demoMode={demoMode}
            operator={selectedOperator}
            onEditOperator={() => setOperatorEditor(selectedOperator)}
            onAddVehicle={() => setVehicleEditor({ open: true, vehicle: null })}
            onEditVehicle={(vehicle) => setVehicleEditor({ open: true, vehicle })}
          />
        )}
      </div>

      {operatorEditor !== undefined ? <OperatorEditor key={operatorEditor?.id ?? "new"} capabilities={capabilities} mapboxAccessToken={mapboxAccessToken} operator={operatorEditor} onClose={() => setOperatorEditor(undefined)} onSaved={(operatorId) => { setSelectedOperatorId(operatorId); setOperatorEditor(undefined); setMode("operators"); router.refresh(); }} /> : null}
      {jobEditor !== undefined ? <JobEditor key={jobEditor?.id ?? "new-job"} capabilities={capabilities} job={jobEditor} mapboxAccessToken={mapboxAccessToken} onClose={() => setJobEditor(undefined)} onSaved={(jobId) => { setSelectedJobId(jobId); setJobEditor(undefined); setMode("jobs"); router.refresh(); }} /> : null}
      {vehicleEditor.open && selectedOperator ? <VehicleEditor key={vehicleEditor.vehicle?.id ?? "new-vehicle"} capabilities={capabilities} operatorId={selectedOperator.id} vehicle={vehicleEditor.vehicle} onClose={() => setVehicleEditor({ open: false, vehicle: null })} onSaved={() => { setVehicleEditor({ open: false, vehicle: null }); router.refresh(); }} /> : null}
    </main>
  );
}
