"use client";

import { MessageCircle, PhoneCall, Send } from "lucide-react";

import type { DriverAccessStatus } from "@/lib/domain/types";
import { buildContactLinks, buildWhatsAppHref } from "@/lib/contact-links";
import {
  buildDriverAssignmentMessage,
  buildDriverAvailabilityMessage,
  type DriverJobContactSummary,
} from "./driver-contact";

interface DriverContactBaseProps {
  phone: string;
  summary: DriverJobContactSummary;
}

interface DriverAvailabilityContactActionsProps extends DriverContactBaseProps {
  distanceKm: number | null;
}

interface DriverAssignmentContactActionsProps extends DriverContactBaseProps {
  accessStatus: DriverAccessStatus | null;
}

function DriverCallLink({ phone, driverName }: { phone: string; driverName: string }) {
  const { callHref } = buildContactLinks(phone);
  if (!callHref) return null;

  return (
    <a
      className="driver-job-contact driver-job-contact-call"
      href={callHref}
      aria-label={`Hringja í ${driverName}: ${phone}`}
    >
      <PhoneCall size={14} /> Hringja
    </a>
  );
}

export function DriverAvailabilityContactActions({
  distanceKm,
  phone,
  summary,
}: DriverAvailabilityContactActionsProps) {
  const whatsappHref = buildWhatsAppHref(
    phone,
    buildDriverAvailabilityMessage(summary, distanceKm),
  );

  return (
    <div className="driver-job-contact-actions" aria-label={`Hafa samband við ${summary.driverName}`}>
      <DriverCallLink driverName={summary.driverName} phone={phone} />
      {whatsappHref ? (
        <a
          className="driver-job-contact driver-job-contact-whatsapp"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Spyrja ${summary.driverName} um framboð í WhatsApp`}
        >
          <MessageCircle size={14} /> Spyrja um framboð
        </a>
      ) : null}
    </div>
  );
}

const unavailableAccessCopy: Record<Exclude<DriverAccessStatus, "active"> | "missing", string> = {
  invited: "Ökumaður þarf fyrst að klára aðgangsboðið.",
  disabled: "Ökumannsaðgangur er óvirkur.",
  missing: "Stofna þarf ökumannsaðgang áður en innskráningarhlekkur er sendur.",
};

export function DriverAssignmentContactActions({
  accessStatus,
  phone,
  summary,
}: DriverAssignmentContactActionsProps) {
  const { whatsappHref } = buildContactLinks(phone);

  function openAssignmentMessage() {
    const driverUrl = new URL("/driver", window.location.origin).toString();
    const href = buildWhatsAppHref(phone, buildDriverAssignmentMessage(summary, driverUrl));
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="assigned-driver-contact">
      <div className="driver-job-contact-actions">
        <DriverCallLink driverName={summary.driverName} phone={phone} />
        {accessStatus === "active" && whatsappHref ? (
          <button
            className="driver-job-contact driver-job-contact-whatsapp"
            type="button"
            onClick={openAssignmentMessage}
            aria-label={`Senda úthlutun til ${summary.driverName} í WhatsApp`}
          >
            <Send size={14} /> Senda úthlutun
          </button>
        ) : null}
      </div>
      {accessStatus !== "active" ? (
        <p>{unavailableAccessCopy[accessStatus ?? "missing"]}</p>
      ) : (
        <p>Opnar WhatsApp með innskráningarhlekk; þú ýtir sjálf/ur á Senda.</p>
      )}
    </div>
  );
}
