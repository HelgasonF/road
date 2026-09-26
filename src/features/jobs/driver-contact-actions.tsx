"use client";

import { PhoneCall, Send } from "lucide-react";
import { useState, useTransition } from "react";

import { recordJobContactAction } from "@/features/job-timeline/actions";
import { createDriverAccessLinkAction } from "@/features/operators/actions";
import { ManualWhatsAppMessage } from "@/features/whatsapp/manual-message";
import type { JobContactPurpose } from "@/lib/domain/types";
import type { DriverAccessStatus } from "@/lib/domain/types";
import { buildContactLinks } from "@/lib/contact-links";
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
  const message = buildDriverAvailabilityMessage(summary, distanceKm);

  return (
    <div className="match-contact-block">
      <div className="driver-job-contact-actions" aria-label={`Hafa samband við ${summary.driverName}`}>
        <DriverCallLink driverName={summary.driverName} jobId={jobId} operatorId={operatorId} phone={phone} purpose="availability" />
      </div>
      <ManualWhatsAppMessage
        message={message}
        onOpen={() => recordContact(jobId, operatorId, "whatsapp", "availability")}
        phone={phone}
        recipientName={summary.driverName}
      />
    </div>
  );
}

export function DriverAssignmentContactActions({
  accessStatus,
  jobId,
  operatorId,
  phone,
  summary,
}: DriverAssignmentContactActionsProps) {
  const { whatsappHref } = buildContactLinks(phone);
  const [driverUrl, setDriverUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const assignmentMessage = driverUrl
    ? buildDriverAssignmentMessage(summary, driverUrl)
    : null;

  function createAssignmentLink() {
    setError(null);
    startTransition(async () => {
      const result = await createDriverAccessLinkAction({ operatorId });
      if (!result.ok || !result.data) {
        setError(result.error ?? "Ekki tókst að búa til ökumannstengil.");
        return;
      }
      setDriverUrl(new URL(result.data.path, window.location.origin).toString());
    });
  }

  return (
    <div className="assigned-driver-contact">
      <div className="driver-job-contact-actions">
        <DriverCallLink driverName={summary.driverName} jobId={jobId} operatorId={operatorId} phone={phone} purpose="assignment" />
        {accessStatus !== "disabled" && whatsappHref && !driverUrl ? (
          <button
            className="driver-job-contact driver-job-contact-whatsapp"
            type="button"
            disabled={pending}
            onClick={createAssignmentLink}
            aria-label={`Búa til öruggan úthlutunartengil fyrir ${summary.driverName}`}
          >
            <Send size={14} /> {pending ? "Bý til…" : "Búa til tengil"}
          </button>
        ) : null}
      </div>
      {accessStatus === "disabled" ? (
        <p>Ökumannsaðgangur er óvirkur.</p>
      ) : assignmentMessage ? (
        <ManualWhatsAppMessage
          key={assignmentMessage}
          message={assignmentMessage}
          onOpen={() => recordContact(jobId, operatorId, "whatsapp", "assignment")}
          phone={phone}
          recipientName={summary.driverName}
        />
      ) : (
        <p>Býr til einkatengil fyrir ökumanninn. Afritaðu síðan skilaboðin í WhatsApp Business.</p>
      )}
      {error ? <p className="compact-error" role="alert">{error}</p> : null}
    </div>
  );
}
