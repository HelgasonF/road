"use client";

import {
  CarFront,
  CircleDot,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Radio,
  Route,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { availabilityStatuses, type AvailabilityStatus, type Operator, type Vehicle } from "@/lib/domain/types";
import {
  availabilityLabels,
  capabilityLabels,
  is,
  vehicleTypeLabels,
} from "@/lib/i18n/is";
import { updateAvailabilityAction } from "./actions";

interface OperatorDetailProps {
  demoMode: boolean;
  operator: Operator | null;
  onEditOperator: () => void;
  onAddVehicle: () => void;
  onEditVehicle: (vehicle: Vehicle) => void;
}

const icelandicMonths = [
  "jan.", "feb.", "mars", "apr.", "maí", "júní",
  "júlí", "ágú.", "sept.", "okt.", "nóv.", "des.",
];

function formatIcelandicDate(value: string) {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()}. ${icelandicMonths[date.getMonth()]} kl. ${hours}:${minutes}`;
}

export function OperatorDetail({
  demoMode,
  operator,
  onEditOperator,
  onAddVehicle,
  onEditVehicle,
}: OperatorDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!operator) {
    return (
      <aside className="detail-panel detail-panel-empty">
        <div className="empty-orbit"><CircleDot size={30} /></div>
        <h2>{is.operatorDetails}</h2>
        <p>{is.noOperatorSelected}</p>
      </aside>
    );
  }

  function changeAvailability(availabilityStatus: AvailabilityStatus) {
    if (!operator) return;
    setError(null);
    startTransition(async () => {
      const result = await updateAvailabilityAction({
        operatorId: operator.id,
        availabilityStatus,
      });
      if (!result.ok) {
        setError(result.error ?? "Ekki tókst að breyta stöðu.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <div className="operator-avatar operator-avatar-large">{operator.name.charAt(0)}</div>
        <div className="detail-title">
          <span className={`status-pill status-${operator.availabilityStatus}`}>
            {availabilityLabels[operator.availabilityStatus]}
          </span>
          <h2>{operator.name}</h2>
          <p>{operator.companyName ?? "Sjálfstæður þjónustuaðili"}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          disabled={demoMode}
          onClick={onEditOperator}
          aria-label={is.editOperator}
          title={demoMode ? is.demoMode : is.editOperator}
        >
          <Pencil size={18} />
        </button>
      </div>

      <a className="phone-link" href={`tel:${operator.phone}`}>
        <Phone size={17} />
        {operator.phone}
      </a>

      <section className="detail-section">
        <div className="section-heading">
          <h3>{is.availability}</h3>
          {pending ? <span className="inline-loader" aria-label="Vista stöðu" /> : null}
        </div>
        <div className="status-selector">
          {availabilityStatuses.map((status) => (
            <button
              className={operator.availabilityStatus === status ? "status-option-active" : ""}
              key={status}
              type="button"
              disabled={demoMode || pending}
              onClick={() => changeAvailability(status)}
            >
              <span className={`status-dot status-dot-${status}`} />
              {availabilityLabels[status]}
            </button>
          ))}
        </div>
        {error ? <p className="compact-error" role="alert">{error}</p> : null}
      </section>

      <section className="detail-section location-summary">
        <h3>{is.baseLocation}</h3>
        <div className="info-row">
          <MapPin size={18} />
          <div>
            <strong>{operator.baseAddress}</strong>
            <span>{is.serviceRadius}: {operator.serviceRadiusKm ?? "—"} {operator.serviceRadiusKm ? is.km : ""}</span>
          </div>
        </div>
        {operator.currentLatitude !== null && operator.currentLongitude !== null ? (
          <div className="info-row">
            <Radio size={18} />
            <div>
              <strong>{is.currentLocation}</strong>
              <span>
                {operator.currentLocationUpdatedAt
                  ? `${is.updated} ${formatIcelandicDate(operator.currentLocationUpdatedAt)}`
                  : `${operator.currentLatitude.toFixed(4)}, ${operator.currentLongitude.toFixed(4)}`}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="detail-section">
        <h3>{is.capabilities}</h3>
        <div className="tag-list">
          {operator.capabilities.map((capability) => (
            <span className="capability-tag" key={capability}>{capabilityLabels[capability]}</span>
          ))}
        </div>
      </section>

      <section className="detail-section vehicles-section">
        <div className="section-heading">
          <h3>{is.vehicles}</h3>
          <button
            className="small-action"
            type="button"
            disabled={demoMode}
            onClick={onAddVehicle}
            title={demoMode ? is.demoMode : is.addVehicle}
          >
            <Plus size={15} /> {is.addVehicle}
          </button>
        </div>
        <div className="vehicle-list">
          {operator.vehicles.map((vehicle) => (
            <button
              className="vehicle-card"
              key={vehicle.id}
              type="button"
              disabled={demoMode}
              onClick={() => onEditVehicle(vehicle)}
            >
              <span className="vehicle-icon">
                {vehicle.vehicleType === "service_van" ? <CarFront size={20} /> : <Truck size={20} />}
              </span>
              <span>
                <strong>{vehicle.name}</strong>
                <small>{vehicleTypeLabels[vehicle.vehicleType]} · {vehicle.registrationNumber ?? "án númers"}</small>
              </span>
              <Pencil size={14} />
            </button>
          ))}
          {operator.vehicles.length === 0 ? <p className="muted-copy">Engin ökutæki skráð.</p> : null}
        </div>
      </section>

      {operator.notes ? (
        <section className="detail-section notes-section">
          <h3>{is.notes}</h3>
          <p>{operator.notes}</p>
        </section>
      ) : null}

      <div className="future-match-note">
        <Route size={17} />
        <span>Fjarlægð og hæfniröðun birtist hér þegar verkefni er valið.</span>
      </div>
    </aside>
  );
}
