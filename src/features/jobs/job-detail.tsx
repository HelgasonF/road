"use client";

import { Building2, CheckCircle2, Clock3, History, MapPin, Pencil, ReceiptText, Route, Truck, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { ContactActions } from "@/features/contact/contact-actions";
import { CustomerLinkPanel } from "@/features/customer-intake/customer-link-panel";
import { JobPhotoGallery } from "@/features/customer-intake/job-photo-gallery";
import type { CustomerIntakeLinkSummary } from "@/features/customer-intake/queries";
import type { Job, JobStatus, Operator } from "@/lib/domain/types";
import { jobStatuses } from "@/lib/domain/types";
import {
  availabilityLabels,
  capabilityLabels,
  is,
  jobPriorityLabels,
  jobStatusLabels,
} from "@/lib/i18n/is";
import type { JobOperatorMatch } from "./queries";
import { assignJobAction, updateJobStatusAction } from "./actions";
import {
  DriverAssignmentContactActions,
  DriverAvailabilityContactActions,
} from "./driver-contact-actions";
import type { DriverJobContactSummary } from "./driver-contact";
import { buildJobCandidates } from "./matching";

interface JobDetailProps {
  demoMode: boolean;
  job: Job | null;
  customerLink: CustomerIntakeLinkSummary | null;
  matches: JobOperatorMatch[];
  operators: Operator[];
  onChanged: () => void;
  onEdit: () => void;
}

function driverContactSummary(job: Job, driverName: string): DriverJobContactSummary {
  return {
    driverName,
    locationLabel: job.locationLabel,
    priority: job.priority,
    requiredCapabilities: job.requiredCapabilities,
  };
}

export function JobDetail({ customerLink, demoMode, job, matches, operators, onChanged, onEdit }: JobDetailProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState(job?.assignment?.operatorId ?? "");
  const [selectedVehicleId, setSelectedVehicleId] = useState(job?.assignment?.vehicleId ?? "");
  const [nextStatus, setNextStatus] = useState<JobStatus>(job?.status ?? "new");
  const [suitableOnly, setSuitableOnly] = useState(false);

  const candidates = useMemo(() => {
    if (!job) return [];
    return buildJobCandidates(job.id, operators, matches);
  }, [job, matches, operators]);

  if (!job) {
    return (
      <aside className="detail-panel detail-panel-empty">
        <span className="empty-orbit"><Route size={28} /></span>
        <h2>Veldu verkefni</h2>
        <p>Veldu verkefni af listanum eða kortinu til að sjá upplýsingar og úthluta því.</p>
      </aside>
    );
  }

  const selectedOperator = operators.find((operator) => operator.id === selectedOperatorId) ?? null;
  const assignedOperator = job.assignment
    ? operators.find((operator) => operator.id === job.assignment?.operatorId) ?? null
    : null;
  const isClosed = job.status === "completed" || job.status === "cancelled";
  const availableStatuses = job.intakePending
    ? jobStatuses.filter((status) => status === "new" || status === "cancelled")
    : jobStatuses;
  const assignmentUnchanged = Boolean(
    job.assignment
      && job.assignment.operatorId === selectedOperatorId
      && (job.assignment.vehicleId ?? "") === selectedVehicleId,
  );
  const suitableCount = candidates.filter((candidate) => candidate.isSuitable).length;
  const visibleCandidates = suitableOnly
    ? candidates.filter((candidate) => candidate.isSuitable)
    : candidates;

  function assign() {
    if (!selectedOperatorId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignJobAction({
        jobId: job!.id,
        operatorId: selectedOperatorId,
        vehicleId: selectedVehicleId || null,
        notes: null,
      });
      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að úthluta verkefninu.");
        return;
      }
      onChanged();
    });
  }

  function updateStatus() {
    setError(null);
    startTransition(async () => {
      const result = await updateJobStatusAction({ jobId: job!.id, status: nextStatus, notes: null });
      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að breyta stöðu.");
        return;
      }
      onChanged();
    });
  }

  return (
    <aside className="detail-panel job-detail-panel">
      <header className="detail-header">
        <span className={`job-avatar job-priority-${job.priority}`}><Route size={22} /></span>
        <div className="detail-title">
          <span className={`status-pill ${job.intakePending ? "job-status-pending-intake" : `job-status-${job.status}`}`}>{job.intakePending ? "Bíður viðskiptavinar" : jobStatusLabels[job.status]}</span>
          <h2>{job.intakePending ? job.customerPhone : job.customerName}</h2>
          <p>{job.intakePending ? "Upplýsingatengill hefur verið búinn til" : job.locationLabel}</p>
        </div>
        <button className="icon-button" type="button" disabled={demoMode} onClick={onEdit} aria-label={is.editJob}><Pencil size={16} /></button>
      </header>

      <ContactActions personName={job.intakePending ? "Viðskiptavinur" : job.customerName} phone={job.customerPhone} />

      <div className="job-detail-action-links">
        <Link className="job-timeline-link" href={`/jobs/${job.id}/history`}><History size={17} /> Skoða feril verkefnis</Link>
        {isClosed ? <Link className="job-billing-link" href={`/billing?job=${job.id}`}><ReceiptText size={17} /> Opna uppgjör verkefnis</Link> : null}
      </div>

      {!demoMode && !isClosed ? (
        <CustomerLinkPanel
          customerName={job.intakePending ? "" : job.customerName}
          customerPhone={job.customerPhone}
          jobId={job.id}
          link={customerLink}
        />
      ) : null}

      <section className="detail-section">
        <h3>{is.jobLocation}</h3>
        {job.intakePending ? (
          <p className="pending-intake-copy">Viðskiptavinurinn hefur ekki enn staðfest staðsetninguna.</p>
        ) : (
          <div className="info-row"><MapPin size={18} /><div><strong>{job.locationLabel}</strong><span>{job.latitude.toFixed(4)}, {job.longitude.toFixed(4)}</span></div></div>
        )}
      </section>

      <section className="detail-section">
        <h3>{is.requiredAssistance}</h3>
        {job.intakePending ? (
          <p className="pending-intake-copy">Viðskiptavinurinn velur tegund aðstoðar í upplýsingatenglinum.</p>
        ) : (
          <div className="tag-list">{job.requiredCapabilities.map((capability) => <span className="capability-tag" key={capability}>{capabilityLabels[capability]}</span>)}</div>
        )}
      </section>

      {!job.intakePending ? (
        <section className="detail-section job-summary-grid">
          <div><Clock3 size={15} /><span><small>{is.priority}</small><strong>{jobPriorityLabels[job.priority]}</strong></span></div>
          <div><Truck size={15} /><span><small>Bílamerki</small><strong>{job.vehicleMake || "Óskráð"}</strong></span></div>
          <div><UsersRound size={15} /><span><small>Fjöldi fólks</small><strong>{job.peopleCount ?? "Óskráð"}</strong></span></div>
          {job.rentalCompany ? <div><Building2 size={15} /><span><small>Bílaleiga</small><strong>{job.rentalCompany}</strong></span></div> : null}
        </section>
      ) : null}

      {job.notes ? <section className="detail-section notes-section"><h3>{is.notes}</h3><p>{job.notes}</p></section> : null}
      {job.customerNotes ? <section className="detail-section notes-section customer-notes-section"><h3>Lýsing viðskiptavinar</h3><p>{job.customerNotes}</p></section> : null}
      <JobPhotoGallery photos={job.photos} />

      {job.intakePending ? (
        <section className="detail-section pending-intake-panel">
          <h3>{is.assignment}</h3>
          <p>Hægt verður að raða þjónustuaðilum og úthluta verkefninu þegar viðskiptavinurinn hefur sent upplýsingarnar.</p>
        </section>
      ) : (
        <section className="detail-section">
          <h3>{is.assignment}</h3>
        {job.assignment ? (
          <div className="current-assignment-block">
            <div className="current-assignment"><UserRound size={18} /><span><strong>{job.assignment.operatorName}</strong><small>{job.assignment.vehicleName ?? "Ekkert ökutæki valið"}</small></span></div>
            {assignedOperator && !isClosed ? (
              <DriverAssignmentContactActions
                accessStatus={assignedOperator.driverAccess?.status ?? null}
                jobId={job.id}
                operatorId={assignedOperator.id}
                phone={assignedOperator.phone}
                summary={driverContactSummary(job, assignedOperator.name)}
              />
            ) : null}
          </div>
        ) : <p className="muted-copy">Verkefninu hefur ekki verið úthlutað.</p>}

        {!isClosed ? (
          <div className="assignment-controls">
            <label className="field"><span>Þjónustuaðili</span><select value={selectedOperatorId} onChange={(event) => { setSelectedOperatorId(event.target.value); setSelectedVehicleId(""); }}><option value="">Veldu aðila</option>{candidates.map(({ operator, match, isSuitable }) => <option key={operator.id} value={operator.id}>{operator.name} · {match ? `${match.distanceKm} km` : "—"} · {isSuitable ? "Hentugur" : "þarf yfirferð"}</option>)}</select></label>
            <label className="field"><span>Ökutæki</span><select value={selectedVehicleId} disabled={!selectedOperator} onChange={(event) => setSelectedVehicleId(event.target.value)}><option value="">Ekkert valið</option>{selectedOperator?.vehicles.filter((vehicle) => vehicle.isActive).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
            <button className="primary-button full-button" type="button" disabled={demoMode || pending || !selectedOperatorId || assignmentUnchanged} onClick={assign}>{pending ? is.saving : assignmentUnchanged ? is.assignmentUnchanged : job.assignment ? is.reassign : is.assign}</button>
          </div>
        ) : null}
        </section>
      )}

      {!isClosed && !job.intakePending ? (
        <section className="detail-section">
          <div className="matching-heading">
            <div><h3>Röðun þjónustuaðila</h3><span>{suitableCount === 1 ? "1 hentugur" : `${suitableCount} hentugir`} af {candidates.length}</span></div>
            <label><input type="checkbox" checked={suitableOnly} onChange={(event) => setSuitableOnly(event.target.checked)} /> Aðeins hentugir</label>
          </div>
          <p className="matching-contact-note">Spurðu um framboð án upplýsinga um viðskiptavin. WhatsApp opnast með tilbúnum texta en þú ýtir sjálf/ur á Senda.</p>
          <div className="match-list">
            {visibleCandidates.map(({ operator, match, hasRequiredCapabilities, isSuitable, withinServiceArea }, index) => (
              <article className={`match-card ${selectedOperatorId === operator.id ? "match-card-selected" : ""}`} key={operator.id}>
                <button className="match-select-button" type="button" aria-pressed={selectedOperatorId === operator.id} onClick={() => { setSelectedOperatorId(operator.id); setSelectedVehicleId(""); }}>
                  <b>{index + 1}</b><span><strong>{operator.name}</strong><small>{availabilityLabels[operator.availabilityStatus]} · {match ? `${match.distanceKm} km` : "fjarlægð óþekkt"}</small></span>
                  <span className="match-criteria">
                    {isSuitable ? <i className="match-suitable">Hentugur</i> : null}
                    <i className={withinServiceArea ? "match-ok" : "match-missing"}>{withinServiceArea ? "Innan svæðis" : "Utan svæðis"}</i>
                    <i className={hasRequiredCapabilities ? "match-ok" : "match-missing"}>{hasRequiredCapabilities ? "Hæfur" : "Vantar getu"}</i>
                  </span>
                </button>
                <DriverAvailabilityContactActions
                  distanceKm={match?.distanceKm ?? null}
                  jobId={job.id}
                  operatorId={operator.id}
                  phone={operator.phone}
                  summary={driverContactSummary(job, operator.name)}
                />
              </article>
            ))}
            {visibleCandidates.length === 0 ? <p className="match-empty">Enginn laus þjónustuaðili er bæði innan þjónustusvæðis og með rétta getu.</p> : null}
          </div>
        </section>
      ) : null}

      <section className="detail-section">
        <h3>{is.jobStatus}</h3>
        <div className="status-update-row">
          <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as JobStatus)}>{availableStatuses.map((status) => <option key={status} value={status}>{jobStatusLabels[status]}</option>)}</select>
          <button className="secondary-button" type="button" disabled={demoMode || pending || nextStatus === job.status} onClick={updateStatus}><CheckCircle2 size={15} /> Uppfæra</button>
        </div>
      </section>

      {error ? <p className="compact-error" role="alert">{error}</p> : null}
    </aside>
  );
}
