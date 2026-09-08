"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  CarFront,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  ExternalLink,
  LogOut,
  MapPin,
  MapPinned,
  Navigation,
  Route,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { logoutAction } from "@/features/auth/actions";
import { ContactActions } from "@/features/contact/contact-actions";
import { JobPhotoGallery } from "@/features/customer-intake/job-photo-gallery";
import type {
  AvailabilityStatus,
  Job,
  JobStatus,
  Operator,
} from "@/lib/domain/types";
import {
  availabilityLabels,
  capabilityLabels,
  jobPriorityLabels,
  jobStatusLabels,
  vehicleTypeLabels,
} from "@/lib/i18n/is";
import {
  respondToDriverAssignmentAction,
  setDriverAvailabilityAction,
  updateDriverJobStatusAction,
} from "./actions";
import { DriverMap } from "./driver-map";
import { buildDirectionsHref, formatDriverTimestamp, getDriverStatusActions } from "./workflow";

interface DriverWorkspaceProps {
  demoMode: boolean;
  jobs: Job[];
  operator: Operator;
}

const visibleAvailabilityStatuses: AvailabilityStatus[] = [
  "available",
  "busy",
  "unavailable",
  "offline",
];

function jobVehicle(job: Job) {
  return job.vehicleMake || "Bílamerki óskráð";
}

export function DriverWorkspace({ demoMode, jobs, operator }: DriverWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedJobId, setSelectedJobId] = useState(
    jobs.find((job) => job.status !== "completed" && job.status !== "cancelled")?.id
      ?? jobs[0]?.id
      ?? null,
  );
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const orderedJobs = useMemo(() => [...jobs].sort((left, right) => {
    const leftClosed = left.status === "completed" || left.status === "cancelled";
    const rightClosed = right.status === "completed" || right.status === "cancelled";
    if (leftClosed !== rightClosed) return leftClosed ? 1 : -1;
    return right.createdAt.localeCompare(left.createdAt);
  }), [jobs]);
  const selectedJob = orderedJobs.find((job) => job.id === selectedJobId) ?? orderedJobs[0] ?? null;
  const activeCount = jobs.filter((job) => job.status !== "completed" && job.status !== "cancelled").length;

  function refreshAfter(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Aðgerðin mistókst.");
        return;
      }
      setShowDecline(false);
      setDeclineReason("");
      router.refresh();
    });
  }

  function changeAvailability(status: AvailabilityStatus) {
    refreshAfter(() => setDriverAvailabilityAction({ status }));
  }

  function respond(accept: boolean) {
    if (!selectedJob?.assignment) return;
    refreshAfter(() => respondToDriverAssignmentAction({
      assignmentId: selectedJob.assignment!.id,
      accept,
      notes: accept ? null : declineReason,
    }));
  }

  function updateStatus(status: JobStatus) {
    if (!selectedJob) return;
    refreshAfter(() => updateDriverJobStatusAction({
      jobId: selectedJob.id,
      status,
      notes: null,
    }));
  }

  return (
    <main className="driver-app">
      <header className="driver-topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><MapPinned size={22} /></span>
          <span><strong>Vegstoð</strong><small>Ökumannsskjár</small></span>
        </div>
        <div className="driver-topbar-actions">
          {demoMode ? <span className="demo-badge">Sýnishamur</span> : null}
          <span className="driver-identity"><CircleUserRound size={23} /><span><strong>{operator.name}</strong><small>{operator.phone}</small></span></span>
          <form action={logoutAction}><button className="icon-button" type="submit" aria-label="Skrá út"><LogOut size={18} /></button></form>
        </div>
      </header>

      <section className="driver-shell">
        <aside className="driver-sidebar">
          <div className="driver-welcome">
            <p className="eyebrow">Mín vakt</p>
            <h1>Góðan dag, {operator.name.split(" ")[0]}</h1>
            <p>{activeCount === 0 ? "Ekkert virkt verkefni" : activeCount === 1 ? "1 virkt verkefni" : `${activeCount} virk verkefni`}</p>
          </div>

          <section className="availability-card" aria-labelledby="availability-heading">
            <div><span className={`status-dot status-dot-${operator.availabilityStatus}`} /><span><small id="availability-heading">Mín staða</small><strong>{availabilityLabels[operator.availabilityStatus]}</strong></span></div>
            <select
              aria-label="Breyta minni stöðu"
              disabled={demoMode || pending}
              value={operator.availabilityStatus}
              onChange={(event) => changeAvailability(event.target.value as AvailabilityStatus)}
            >
              {visibleAvailabilityStatuses.map((status) => <option key={status} value={status}>{availabilityLabels[status]}</option>)}
            </select>
          </section>

          <div className="driver-list-heading"><h2>Verkefni</h2><span>{jobs.length}</span></div>
          <div className="driver-job-list">
            {orderedJobs.map((job) => (
              <button
                className={`driver-job-row ${selectedJob?.id === job.id ? "driver-job-row-selected" : ""}`}
                key={job.id}
                type="button"
                onClick={() => { setSelectedJobId(job.id); setError(null); setShowDecline(false); }}
              >
                <span className={`driver-job-icon job-priority-${job.priority}`}><Route size={18} /></span>
                <span><strong>{job.locationLabel}</strong><small>{job.customerName} · {jobStatusLabels[job.status]}</small></span>
                <ChevronRight size={18} />
              </button>
            ))}
            {orderedJobs.length === 0 ? (
              <div className="driver-empty-list"><ShieldCheck size={30} /><strong>Engin verkefni</strong><p>Ný úthlutun birtist hér.</p></div>
            ) : null}
          </div>
        </aside>

        <section className="driver-content">
          {selectedJob ? (
            <article className="driver-job-detail">
              <header className="driver-job-header">
                <div>
                  <span className={`status-pill job-status-${selectedJob.status}`}>{jobStatusLabels[selectedJob.status]}</span>
                  <p className="eyebrow">Verkefni</p>
                  <h2>{selectedJob.locationLabel}</h2>
                  <p><Clock3 size={15} /> Úthlutað {formatDriverTimestamp(selectedJob.assignment?.assignedAt ?? selectedJob.createdAt)}</p>
                </div>
                <span className={`driver-priority job-priority-${selectedJob.priority}`}>{jobPriorityLabels[selectedJob.priority]} forgangur</span>
              </header>

              {selectedJob.status === "assigned" && selectedJob.assignment ? (
                <section className="assignment-response-card">
                  <div><BriefcaseBusiness size={22} /><span><strong>Ný úthlutun</strong><p>Staðfestu hvort þú getir tekið verkefnið.</p></span></div>
                  {!showDecline ? (
                    <div className="assignment-response-actions">
                      <button className="primary-button" type="button" disabled={demoMode || pending} onClick={() => respond(true)}><Check size={18} /> Samþykkja</button>
                      <button className="secondary-button" type="button" disabled={demoMode || pending} onClick={() => setShowDecline(true)}><X size={18} /> Hafna</button>
                    </div>
                  ) : (
                    <div className="decline-form">
                      <label><span>Ástæða höfnunar</span><textarea value={declineReason} maxLength={1000} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Til dæmis of langt frá eða búnaður ekki tiltækur" /></label>
                      <div><button className="danger-button" type="button" disabled={demoMode || pending || declineReason.trim().length < 2} onClick={() => respond(false)}>Staðfesta höfnun</button><button className="text-button" type="button" onClick={() => setShowDecline(false)}>Til baka</button></div>
                    </div>
                  )}
                </section>
              ) : null}

              <div className="driver-detail-grid">
                <section className="driver-card driver-location-card">
                  <div className="driver-card-heading"><MapPin size={20} /><span><small>Staðsetning</small><strong>{selectedJob.locationLabel}</strong></span></div>
                  <div className="coordinate-line">{selectedJob.latitude.toFixed(5)}, {selectedJob.longitude.toFixed(5)}</div>
                  <DriverMap
                    latitude={selectedJob.latitude}
                    locationLabel={selectedJob.locationLabel}
                    longitude={selectedJob.longitude}
                  />
                  <a className="navigation-button" href={buildDirectionsHref(selectedJob.latitude, selectedJob.longitude)} target="_blank" rel="noopener noreferrer"><Navigation size={19} /> Opna leiðsögn <ExternalLink size={15} /></a>
                </section>

                <section className="driver-card">
                  <div className="driver-card-heading"><CircleUserRound size={20} /><span><small>Viðskiptavinur</small><strong>{selectedJob.customerName}</strong></span></div>
                  <ContactActions personName={selectedJob.customerName} phone={selectedJob.customerPhone} />
                </section>

                <section className="driver-card">
                  <div className="driver-card-heading"><CarFront size={20} /><span><small>Ökutæki viðskiptavinar</small><strong>{jobVehicle(selectedJob)}</strong></span></div>
                  <dl className="driver-facts">
                    <div><dt>Skráning</dt><dd>{selectedJob.vehicleRegistration ?? "Óskráð"}</dd></div>
                    <div><dt>Fjöldi fólks</dt><dd>{selectedJob.peopleCount ?? "Óskráð"}</dd></div>
                    {selectedJob.rentalCompany ? <div><dt>Bílaleiga</dt><dd>{selectedJob.rentalCompany}</dd></div> : null}
                    <div><dt>Forgangur</dt><dd>{jobPriorityLabels[selectedJob.priority]}</dd></div>
                  </dl>
                </section>

                <section className="driver-card">
                  <div className="driver-card-heading"><Truck size={20} /><span><small>Mitt ökutæki</small><strong>{selectedJob.assignment?.vehicleName ?? "Ekkert ökutæki valið"}</strong></span></div>
                  {selectedJob.assignment?.vehicleId ? (() => {
                    const vehicle = operator.vehicles.find((item) => item.id === selectedJob.assignment?.vehicleId);
                    return vehicle ? <p className="driver-card-copy">{vehicleTypeLabels[vehicle.vehicleType]}{vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ""}</p> : null;
                  })() : <p className="driver-card-copy">Hafðu samband við aðgerðastjórn ef velja þarf ökutæki.</p>}
                </section>
              </div>

              <section className="driver-card driver-assistance-card">
                <h3>Umbeðin aðstoð</h3>
                <div className="tag-list">{selectedJob.requiredCapabilities.map((capability) => <span className="capability-tag" key={capability}>{capabilityLabels[capability]}</span>)}</div>
                {selectedJob.notes ? <div className="driver-notes"><strong>Athugasemdir</strong><p>{selectedJob.notes}</p></div> : null}
                {selectedJob.customerNotes ? <div className="driver-notes"><strong>Lýsing viðskiptavinar</strong><p>{selectedJob.customerNotes}</p></div> : null}
              </section>

              <JobPhotoGallery photos={selectedJob.photos} />

              {getDriverStatusActions(selectedJob.status).length > 0 ? (
                <section className="driver-next-actions">
                  <div><p className="eyebrow">Næsta skref</p><h3>Uppfæra verkefnið</h3></div>
                  <div>{getDriverStatusActions(selectedJob.status).map((action, index) => (
                    <button className={index === 0 ? "primary-button" : "secondary-button"} key={action.status} type="button" disabled={demoMode || pending} onClick={() => updateStatus(action.status)}>{action.label} <ArrowRight size={17} /></button>
                  ))}</div>
                </section>
              ) : null}

              {selectedJob.status === "completed" ? <div className="driver-completed"><Check size={22} /><span><strong>Verkefninu er lokið</strong><p>Staðan hefur verið send til aðgerðastjórnar.</p></span></div> : null}
              {error ? <p className="form-error driver-error" role="alert">{error}</p> : null}
            </article>
          ) : (
            <div className="driver-empty-state"><ShieldCheck size={48} /><h2>Þú ert tilbúinn</h2><p>Nýtt verkefni birtist hér þegar aðgerðastjórn úthlutar því til þín.</p></div>
          )}
        </section>
      </section>
    </main>
  );
}
