"use client";

import { Check, CheckCircle2, MessageCircle, PencilLine, X } from "lucide-react";
import { FormEvent, useRef, useState, useTransition } from "react";
import { PhoneInput } from "@/components/phone-input";
import { FieldError, FormErrorSummary } from "@/components/form-errors";
import { fieldErrorMessage, focusFormField, formFieldKey, localizeFieldErrors, nativeFormErrors, type FormErrors } from "@/lib/form-errors";
import { formatPhoneNumber } from "@/lib/phone";

import { createQuickCustomerIntakeJobAction } from "@/features/customer-intake/actions";
import { buildCustomerIntakeWhatsAppMessage } from "@/features/customer-intake/customer-contact";
import { formatCustomerLinkExpiry } from "@/features/customer-intake/format";
import { ManualWhatsAppMessage } from "@/features/whatsapp/manual-message";
import { AddressSearchField, type AddressSearchFieldHandle } from "@/features/location/address-search-field";
import type { Capability, CapabilityCode, Job } from "@/lib/domain/types";
import { jobPriorities } from "@/lib/domain/types";
import { OTHER_VEHICLE_MAKE, vehicleMakes } from "@/lib/domain/vehicle-makes";
import { capabilityLabels, is, jobPriorityLabels } from "@/lib/i18n/is";
import { saveJobAction } from "./actions";
import { jobInputSchema } from "./schemas";

interface JobEditorProps {
  capabilities: Capability[];
  job: Job | null;
  onClose: () => void;
  onQuickCreated: (jobId: string) => void;
  onSaved: (jobId: string) => void;
}

interface QuickLinkResult {
  expiresAt: string;
  message: string;
  phone: string;
}

export function JobEditor({ capabilities, job, onClose, onQuickCreated, onSaved }: JobEditorProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const locationRef = useRef<AddressSearchFieldHandle>(null);
  const [entryMode, setEntryMode] = useState<"quick" | "full">(job ? "full" : "quick");
  const [quickLink, setQuickLink] = useState<QuickLinkResult | null>(null);
  const [selectedCapabilities, setSelectedCapabilities] = useState<CapabilityCode[]>(
    job?.requiredCapabilities ?? [],
  );
  const initialVehicleMake = job?.vehicleMake?.trim() ?? "";
  const knownInitialVehicleMake = vehicleMakes.find(
    (make) => make.toLocaleLowerCase() === initialVehicleMake.toLocaleLowerCase(),
  );
  const [vehicleMakeSelection, setVehicleMakeSelection] = useState(
    knownInitialVehicleMake ?? (initialVehicleMake ? OTHER_VEHICLE_MAKE : ""),
  );

  function showFieldErrors(errors: FormErrors) {
    setFieldErrors(errors);
    if (Object.keys(errors)[0]) focusFormField(formRef.current, Object.keys(errors)[0]);
  }

  function fieldProps(name: string) {
    const key = formFieldKey(name);
    return { "data-field": key, "aria-labelledby": name === "requiredCapabilities" ? undefined : `job-${name}-label`, "aria-invalid": Boolean(fieldErrors[key]) || undefined, "aria-describedby": fieldErrors[key] ? `job-${key}-error` : undefined };
  }

  function fieldError(name: string) { return <FieldError id={`job-${name}-error`} message={fieldErrors[name]} />; }

  function submitQuick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const customerPhone = String(form.get("customerPhone") ?? "");

    startTransition(async () => {
      const result = await createQuickCustomerIntakeJobAction({ customerPhone });
      if (!result.ok || !result.data) {
        setError(result.error ?? "Ekki tókst að búa til verkefnið.");
        return;
      }

      const customerUrl = new URL(result.data.path, window.location.origin).toString();
      setQuickLink({
        expiresAt: result.data.expiresAt,
        message: buildCustomerIntakeWhatsAppMessage("", customerUrl),
        phone: customerPhone,
      });
      onQuickCreated(result.data.jobId);
    });
  }

  function submitFull(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const vehicleMake = vehicleMakeSelection === OTHER_VEHICLE_MAKE
      ? String(form.get("vehicleMakeOther") ?? "")
      : vehicleMakeSelection;

    startTransition(async () => {
      const location = await locationRef.current?.resolve();
      if (!location) {
        showFieldErrors({ locationLabel: "Skrifaðu bæ eða heimilisfang og veldu úr niðurstöðum ef fleiri en einn staður finnst." });
        return;
      }
      const input = {
        id: job?.id ?? null,
        customerName: String(form.get("customerName") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        vehicleRegistration: String(form.get("vehicleRegistration") ?? ""),
        vehicleMake,
        rentalCompany: String(form.get("rentalCompany") ?? ""),
        peopleCount: Number(form.get("peopleCount")),
        latitude: location.latitude,
        longitude: location.longitude,
        locationLabel: location.label,
        locationSource: location.source,
        priority: String(form.get("priority")) as Job["priority"],
        notes: String(form.get("notes") ?? ""),
        requiredCapabilities: selectedCapabilities,
      };
      const parsed = jobInputSchema.safeParse(input);
      if (!parsed.success) { showFieldErrors(localizeFieldErrors(parsed.error.flatten().fieldErrors, "is")); return; }
      setFieldErrors({});
      const result = await saveJobAction(input);

      if (!result.ok || !result.data) {
        if (result.fieldErrors) { showFieldErrors(localizeFieldErrors(result.fieldErrors, "is")); return; }
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

        {!job && entryMode === "quick" ? (
          quickLink ? (
            <div className="quick-job-success">
              <span><CheckCircle2 size={28} /></span>
              <h3>Verkefnið og tengillinn eru tilbúin</h3>
              <p>Opnaðu WhatsApp eða afritaðu skilaboðin og sendu þau þaðan.</p>
              <small>{formatCustomerLinkExpiry(quickLink.expiresAt, "is")}</small>
              <ManualWhatsAppMessage key={quickLink.message} message={quickLink.message} phone={quickLink.phone} recipientName={formatPhoneNumber(quickLink.phone)} />
              <button className="secondary-button" type="button" onClick={onClose}>Loka</button>
            </div>
          ) : (
            <form className="editor-form quick-job-form" onSubmit={submitQuick}>
              <div className="quick-job-intro">
                <span><MessageCircle size={22} /></span>
                <div>
                  <h3>Sendu viðskiptavininum öruggan upplýsingatengil</h3>
                  <p>Sláðu aðeins inn símanúmerið. Viðskiptavinurinn skráir nafn, staðsetningu, ökutæki, tegund aðstoðar og lýsingu.</p>
                </div>
              </div>
              <PhoneInput className="quick-job-phone" label={is.customerPhone} name="customerPhone" required />
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <button className="primary-button quick-create-button" type="submit" disabled={pending}>
                <MessageCircle size={17} /> {pending ? "Bý til…" : "Búa til WhatsApp-tengil"}
              </button>
              <button className="quick-job-switch" type="button" onClick={() => { setEntryMode("full"); setError(null); }}>
                <PencilLine size={15} /> Ég vil skrá allar upplýsingar sjálf/ur
              </button>
            </form>
          )
        ) : (
          <form
            ref={formRef}
            className="editor-form"
            onInvalidCapture={(event) => {
              const errors = nativeFormErrors(event.currentTarget, "is");
              if (!selectedCapabilities.length) errors.requiredCapabilities = fieldErrorMessage("requiredCapabilities", "is");
              showFieldErrors(errors);
            }}
            onChange={(event) => {
              if (error) setError(null);
              const target = event.target;
              if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
              const key = formFieldKey(target.dataset.field ?? target.name);
              setFieldErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key)));
            }}
            onSubmit={submitFull}
          >
            <FormErrorSummary errors={fieldErrors} formRef={formRef} language="is" />
            {!job ? (
              <button className="quick-job-switch quick-job-switch-back" type="button" onClick={() => { setEntryMode("quick"); setError(null); }}>
                <MessageCircle size={15} /> Til baka í símanúmer og WhatsApp
              </button>
            ) : null}
            <div className="form-grid form-grid-two">
              <label className="field"><span id="job-customerName-label">{is.customerName}</span><input {...fieldProps("customerName")} name="customerName" defaultValue={job?.intakePending ? "" : job?.customerName ?? ""} required />{fieldError("customerName")}</label>
              <PhoneInput label={is.customerPhone} name="customerPhone" defaultValue={job?.customerPhone ?? ""} error={fieldErrors.customerPhone} required />
            </div>

            <div className="form-section">
              <div className="form-section-heading"><strong>{is.jobLocation}</strong><span>Finndu heimilisfang, bæ eða stað á Íslandi.</span></div>
              <AddressSearchField
                ref={locationRef}
                error={fieldErrors.locationLabel}
                onLocationChange={(location) => { if (location) setFieldErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== "locationLabel"))); }}
                defaultLabel={job?.intakePending ? undefined : job?.locationLabel}
                defaultLatitude={job?.intakePending ? undefined : job?.latitude}
                defaultLongitude={job?.intakePending ? undefined : job?.longitude}
                defaultSource={job?.intakePending ? undefined : job?.locationSource}
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
                        {...fieldProps("requiredCapabilities")}
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
              {fieldError("requiredCapabilities")}
            </fieldset>

            <div className="form-grid form-grid-two">
              <label className="field"><span id="job-vehicleRegistration-label">{is.registrationNumber}</span><input {...fieldProps("vehicleRegistration")} name="vehicleRegistration" defaultValue={job?.vehicleRegistration ?? ""} />{fieldError("vehicleRegistration")}</label>
              <label className="field"><span id="job-priority-label">{is.priority}</span><select {...fieldProps("priority")} name="priority" defaultValue={job?.priority ?? "normal"}>{jobPriorities.map((priority) => <option key={priority} value={priority}>{jobPriorityLabels[priority]}</option>)}</select>{fieldError("priority")}</label>
              <label className="field">
                <span id="job-vehicleMake-label">Bílamerki</span>
                <select {...fieldProps("vehicleMake")} value={vehicleMakeSelection} onChange={(event) => setVehicleMakeSelection(event.target.value)}>
                  <option value="">Veldu bílamerki</option>
                  {vehicleMakes.map((make) => <option key={make} value={make}>{make}</option>)}
                  <option value={OTHER_VEHICLE_MAKE}>Önnur / ekki á lista</option>
                </select>
                {fieldError("vehicleMake")}
              </label>
              {vehicleMakeSelection === OTHER_VEHICLE_MAKE ? (
                <label className="field"><span id="job-vehicleMakeOther-label">Skrifaðu bílamerkið</span><input {...fieldProps("vehicleMakeOther")} name="vehicleMakeOther" defaultValue={knownInitialVehicleMake ? "" : initialVehicleMake} maxLength={120} required />{fieldError("vehicleMake")}</label>
              ) : null}
              <label className="field"><span id="job-rentalCompany-label">Bílaleiga (ef við á)</span><input {...fieldProps("rentalCompany")} name="rentalCompany" defaultValue={job?.rentalCompany ?? ""} placeholder="T.d. Hertz eða Blue Car Rental" maxLength={120} />{fieldError("rentalCompany")}</label>
              <label className="field"><span id="job-peopleCount-label">Fjöldi fólks</span><input {...fieldProps("peopleCount")} name="peopleCount" defaultValue={job?.peopleCount ?? 1} inputMode="numeric" min={1} max={99} required type="number" />{fieldError("peopleCount")}</label>
            </div>

            <label className="field"><span id="job-notes-label">{is.notes}</span><textarea {...fieldProps("notes")} name="notes" defaultValue={job?.notes ?? ""} rows={3} />{fieldError("notes")}</label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <footer className="modal-actions">
              <button className="secondary-button" type="button" onClick={onClose}>{is.cancel}</button>
              <button className="primary-button" type="submit" disabled={pending}>{pending ? is.saving : is.save}</button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
