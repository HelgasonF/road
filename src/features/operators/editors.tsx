"use client";

import { Check, X } from "lucide-react";
import { FormEvent, ReactNode, useState, useTransition } from "react";

import type { Capability, CapabilityCode, Operator, Vehicle } from "@/lib/domain/types";
import { AddressSearchField } from "@/features/location/address-search-field";
import {
  availabilityLabels,
  capabilityLabels,
  is,
  vehicleTypeLabels,
} from "@/lib/i18n/is";
import { availabilityStatuses, vehicleTypes } from "@/lib/domain/types";
import { saveOperatorAction, saveVehicleAction } from "./actions";

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className="modal-card"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">{is.appName}</p>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={is.close}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function CapabilityPicker({
  capabilities,
  selected,
  onChange,
}: {
  capabilities: Capability[];
  selected: CapabilityCode[];
  onChange: (capabilities: CapabilityCode[]) => void;
}) {
  return (
    <fieldset className="capability-picker">
      <legend>{is.capabilities}</legend>
      <div className="capability-grid">
        {capabilities.map((capability) => {
          const checked = selected.includes(capability.code);
          return (
            <label className={`capability-choice ${checked ? "capability-choice-selected" : ""}`} key={capability.code}>
              <input
                checked={checked}
                type="checkbox"
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((code) => code !== capability.code)
                      : [...selected, capability.code],
                  )
                }
              />
              <span className="checkbox-mark">{checked ? <Check size={13} /> : null}</span>
              {capabilityLabels[capability.code]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const toNullableNumber = (value: string) => (value.trim() === "" ? null : Number(value));

interface OperatorEditorProps {
  capabilities: Capability[];
  mapboxAccessToken: string | null;
  operator: Operator | null;
  onClose: () => void;
  onSaved: (operatorId: string) => void;
}

export function OperatorEditor({ capabilities, mapboxAccessToken, operator, onClose, onSaved }: OperatorEditorProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCapabilities, setSelectedCapabilities] = useState<CapabilityCode[]>(
    operator?.capabilities ?? [],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveOperatorAction({
        id: operator?.id ?? null,
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        companyName: String(form.get("companyName") ?? ""),
        isActive: form.get("isActive") === "on",
        availabilityStatus: String(form.get("availabilityStatus")) as Operator["availabilityStatus"],
        baseAddress: String(form.get("baseAddress") ?? ""),
        baseLatitude: Number(form.get("baseLatitude")),
        baseLongitude: Number(form.get("baseLongitude")),
        currentLatitude: operator?.currentLatitude ?? null,
        currentLongitude: operator?.currentLongitude ?? null,
        serviceRadiusKm: toNullableNumber(String(form.get("serviceRadiusKm") ?? "")),
        notes: String(form.get("notes") ?? ""),
        capabilities: selectedCapabilities,
      });

      if (!result.ok || !result.data) {
        setError(result.error ?? "Ekki tókst að vista.");
        return;
      }

      onSaved(result.data.id);
    });
  }

  return (
    <Modal title={operator ? is.editOperator : is.newOperator} onClose={onClose}>
      <form
        className="editor-form"
        onChange={() => {
          if (error) setError(null);
        }}
        onSubmit={submit}
      >
        <div className="form-grid form-grid-two">
          <label className="field">
            <span>{is.name}</span>
            <input name="name" defaultValue={operator?.name ?? ""} minLength={2} required />
          </label>
          <label className="field">
            <span>{is.phone}</span>
            <input name="phone" defaultValue={operator?.phone ?? ""} required />
          </label>
          <label className="field">
            <span>{is.companyName}</span>
            <input name="companyName" defaultValue={operator?.companyName ?? ""} />
          </label>
          <label className="field">
            <span>{is.availability}</span>
            <select name="availabilityStatus" defaultValue={operator?.availabilityStatus ?? "available"}>
              {availabilityStatuses.map((status) => (
                <option key={status} value={status}>{availabilityLabels[status]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-section">
          <div className="form-section-heading">
            <strong>{is.baseLocation}</strong>
            <span>Leitaðu að heimilisfangi, bæ eða staðarheiti á Íslandi.</span>
          </div>
          <AddressSearchField
            defaultLabel={operator?.baseAddress}
            defaultLatitude={operator?.baseLatitude}
            defaultLongitude={operator?.baseLongitude}
            label="Heimilisfang eða bækistöð"
            latitudeName="baseLatitude"
            longitudeName="baseLongitude"
            locationLabelName="baseAddress"
            mapboxAccessToken={mapboxAccessToken}
          />
          <div className="location-support-grid">
            <label className="field">
              <span>{is.serviceRadius} ({is.km})</span>
              <input
                name="serviceRadiusKm"
                defaultValue={operator?.serviceRadiusKm ?? 150}
                min="1"
                max="1000"
                step="1"
                type="number"
              />
            </label>
          </div>
        </div>

        <CapabilityPicker
          capabilities={capabilities}
          selected={selectedCapabilities}
          onChange={setSelectedCapabilities}
        />

        <label className="field">
          <span>{is.notes}</span>
          <textarea name="notes" defaultValue={operator?.notes ?? ""} rows={3} />
        </label>

        <label className="toggle-row">
          <input name="isActive" type="checkbox" defaultChecked={operator?.isActive ?? true} />
          <span>{is.active}</span>
        </label>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{is.cancel}</button>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? is.saving : is.save}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

interface VehicleEditorProps {
  capabilities: Capability[];
  operatorId: string;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSaved: () => void;
}

export function VehicleEditor({ capabilities, operatorId, vehicle, onClose, onSaved }: VehicleEditorProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCapabilities, setSelectedCapabilities] = useState<CapabilityCode[]>(
    vehicle?.capabilities ?? [],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveVehicleAction({
        id: vehicle?.id ?? null,
        operatorId,
        name: String(form.get("name") ?? ""),
        registrationNumber: String(form.get("registrationNumber") ?? ""),
        vehicleType: String(form.get("vehicleType")) as Vehicle["vehicleType"],
        maxVehicleWeightKg: toNullableNumber(String(form.get("maxVehicleWeightKg") ?? "")),
        isActive: form.get("isActive") === "on",
        notes: String(form.get("notes") ?? ""),
        capabilities: selectedCapabilities,
      });

      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að vista.");
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal title={vehicle ? is.editVehicle : is.addVehicle} onClose={onClose}>
      <form
        className="editor-form"
        onChange={() => {
          if (error) setError(null);
        }}
        onSubmit={submit}
      >
        <div className="form-grid form-grid-two">
          <label className="field">
            <span>{is.name}</span>
            <input name="name" defaultValue={vehicle?.name ?? ""} minLength={2} required />
          </label>
          <label className="field">
            <span>{is.registrationNumber}</span>
            <input name="registrationNumber" defaultValue={vehicle?.registrationNumber ?? ""} />
          </label>
          <label className="field">
            <span>{is.vehicleType}</span>
            <select name="vehicleType" defaultValue={vehicle?.vehicleType ?? "tow_truck"}>
              {vehicleTypes.map((type) => (
                <option key={type} value={type}>{vehicleTypeLabels[type]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{is.maxVehicleWeightKg}</span>
            <input name="maxVehicleWeightKg" defaultValue={vehicle?.maxVehicleWeightKg ?? ""} min="1" max="100000" type="number" />
          </label>
        </div>

        <CapabilityPicker
          capabilities={capabilities}
          selected={selectedCapabilities}
          onChange={setSelectedCapabilities}
        />

        <label className="field">
          <span>{is.notes}</span>
          <textarea name="notes" defaultValue={vehicle?.notes ?? ""} rows={3} />
        </label>
        <label className="toggle-row">
          <input name="isActive" type="checkbox" defaultChecked={vehicle?.isActive ?? true} />
          <span>{is.active}</span>
        </label>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{is.cancel}</button>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? is.saving : is.save}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
