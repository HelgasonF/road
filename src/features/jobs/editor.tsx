"use client";

import { Check, X } from "lucide-react";
import { FormEvent, useState, useTransition } from "react";

import { AddressSearchField } from "@/features/location/address-search-field";
import type { Capability, CapabilityCode, Job } from "@/lib/domain/types";
import { jobPriorities } from "@/lib/domain/types";
import { capabilityLabels, is, jobPriorityLabels } from "@/lib/i18n/is";
import { saveJobAction } from "./actions";

interface JobEditorProps {
  capabilities: Capability[];
  job: Job | null;
  onClose: () => void;
  onSaved: (jobId: string) => void;
}

export function JobEditor({ capabilities, job, onClose, onSaved }: JobEditorProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCapabilities, setSelectedCapabilities] = useState<CapabilityCode[]>(
    job?.requiredCapabilities ?? [],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveJobAction({
        id: job?.id ?? null,
        customerName: String(form.get("customerName") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        vehicleRegistration: String(form.get("vehicleRegistration") ?? ""),
        vehicleMake: String(form.get("vehicleMake") ?? ""),
        vehicleModel: String(form.get("vehicleModel") ?? ""),
        vehicleType: String(form.get("vehicleType") ?? ""),
        latitude: Number(form.get("latitude")),
        longitude: Number(form.get("longitude")),
        locationLabel: String(form.get("locationLabel") ?? ""),
        locationSource: String(form.get("locationSource") ?? "search") as Job["locationSource"],
        priority: String(form.get("priority")) as Job["priority"],
        notes: String(form.get("notes") ?? ""),
        requiredCapabilities: selectedCapabilities,
      });

      if (!result.ok || !result.data) {
        setError(result.error ?? "Ekki tókst að vista verkefnið.");
        return;
      }
      onSaved(result.data.id);
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="job-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div><p className="eyebrow">{is.jobs}</p><h2 id="job-modal-title">{job ? is.editJob : is.newJob}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={is.close}><X size={20} /></button>
        </header>

        <form
          className="editor-form"
          onChange={() => {
            if (error) setError(null);
          }}
          onSubmit={submit}
        >
          <div className="form-grid form-grid-two">
            <label className="field"><span>{is.customerName}</span><input name="customerName" defaultValue={job?.customerName ?? ""} required /></label>
            <label className="field"><span>{is.customerPhone}</span><input name="customerPhone" defaultValue={job?.customerPhone ?? ""} type="tel" inputMode="tel" autoComplete="tel" placeholder="+354 555 0000 eða erlent númer með landskóða" required /></label>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><strong>{is.jobLocation}</strong><span>Finndu heimilisfang, bæ eða stað á Íslandi.</span></div>
            <AddressSearchField
              defaultLabel={job?.locationLabel}
              defaultLatitude={job?.latitude}
              defaultLongitude={job?.longitude}
              defaultSource={job?.locationSource}
              label="Heimilisfang eða staðarheiti"
              locationSourceName="locationSource"
            />
          </div>

          <fieldset className="capability-picker">
            <legend>{is.requiredAssistance}</legend>
            <div className="capability-grid">
              {capabilities.map((capability) => {
                const checked = selectedCapabilities.includes(capability.code);
                return (
                  <label className={`capability-choice ${checked ? "capability-choice-selected" : ""}`} key={capability.code}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedCapabilities(checked
                        ? selectedCapabilities.filter((code) => code !== capability.code)
                        : [...selectedCapabilities, capability.code])}
                    />
                    <span className="checkbox-mark">{checked ? <Check size={13} /> : null}</span>
                    {capabilityLabels[capability.code]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="form-grid form-grid-two">
            <label className="field"><span>{is.registrationNumber}</span><input name="vehicleRegistration" defaultValue={job?.vehicleRegistration ?? ""} /></label>
            <label className="field"><span>{is.priority}</span><select name="priority" defaultValue={job?.priority ?? "normal"}>{jobPriorities.map((priority) => <option key={priority} value={priority}>{jobPriorityLabels[priority]}</option>)}</select></label>
            <label className="field"><span>Tegund bifreiðar</span><input name="vehicleType" defaultValue={job?.vehicleType ?? ""} placeholder="T.d. fólksbíll eða húsbíll" /></label>
            <label className="field"><span>Tegund / framleiðandi</span><input name="vehicleMake" defaultValue={job?.vehicleMake ?? ""} placeholder="T.d. Toyota" /></label>
            <label className="field"><span>Gerð</span><input name="vehicleModel" defaultValue={job?.vehicleModel ?? ""} placeholder="T.d. RAV4" /></label>
          </div>

          <label className="field"><span>{is.notes}</span><textarea name="notes" defaultValue={job?.notes ?? ""} rows={3} /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <footer className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>{is.cancel}</button>
            <button className="primary-button" type="submit" disabled={pending || selectedCapabilities.length === 0}>{pending ? is.saving : is.save}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
