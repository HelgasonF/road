"use client";

import { MessageCircle, PhoneCall, Send } from "lucide-react";

import { recordJobContactAction } from "@/features/job-timeline/actions";
import type { JobContactPurpose } from "@/lib/domain/types";
import type { DriverAccessStatus } from "@/lib/domain/types";
import { buildContactLinks, buildWhatsAppHref } from "@/lib/contact-links";
import {
  buildDriverAssignmentMessage,
  buildDriverAvailabilityMessage,
  type DriverJobContactSummary,
} from "./driver-contact";

interface DriverContactBaseProps {
  jobId: string;
  operatorId: string;
  phone: string;
  summary: DriverJobContactSummary;
}

interface DriverAvailabilityContactActionsProps extends DriverContactBaseProps {
  distanceKm: number | null;
}

interface DriverAssignmentContactActionsProps extends DriverContactBaseProps {
  accessStatus: DriverAccessStatus | null;
}

function recordContact(jobId: string, operatorId: string, channel: "whatsapp" | "phone", purpose: JobContactPurpose) {
  void recordJobContactAction({ jobId, operatorId, channel, purpose });
}

function DriverCallLink({
  driverName,
  jobId,
  operatorId,
  phone,
  purpose,
}: {
  driverName: string;
  jobId: string;
  operatorId: string;
  phone: string;
  purpose: JobContactPurpose;
}) {
  const { callHref } = buildContactLinks(phone);
  if (!callHref) return null;

  return (
    <a
      className="driver-job-contact driver-job-contact-call"
      href={callHref}
      onClick={() => recordContact(jobId, operatorId, "phone", purpose)}
      aria-label={`Hringja í ${driverName}: ${phone}`}
    >
      <PhoneCall size={14} /> Hringja
    </a>
  );
}

export function DriverAvailabilityContactActions({
  distanceKm,
  jobId,
  operatorId,
  phone,
  summary,
}: DriverAvailabilityContactActionsProps) {
  const whatsappHref = buildWhatsAppHref(
    phone,
    buildDriverAvailabilityMessage(summary, distanceKm),
  );

  return (
    <div className="driver-job-contact-actions" aria-label={`Hafa samband við ${summary.driverName}`}>
      <DriverCallLink driverName={summary.driverName} jobId={jobId} operatorId={operatorId} phone={phone} purpose="availability" />
      {whatsappHref ? (
        <a
          className="driver-job-contact driver-job-contact-whatsapp"
          href={whatsappHref}
          onClick={() => recordContact(jobId, operatorId, "whatsapp", "availability")}
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
  jobId,
  operatorId,
  phone,
  summary,
}: DriverAssignmentContactActionsProps) {
  const { whatsappHref } = buildContactLinks(phone);

  function openAssignmentMessage() {
    recordContact(jobId, operatorId, "whatsapp", "assignment");
    const driverUrl = new URL("/driver", window.location.origin).toString();
    const href = buildWhatsAppHref(phone, buildDriverAssignmentMessage(summary, driverUrl));
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="assigned-driver-contact">
      <div className="driver-job-contact-actions">
        <DriverCallLink driverName={summary.driverName} jobId={jobId} operatorId={operatorId} phone={phone} purpose="assignment" />
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
