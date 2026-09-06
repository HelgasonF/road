"use client";

import { MessageCircle, PhoneCall, Send } from "lucide-react";
import { useState, useTransition } from "react";

import { recordJobContactAction } from "@/features/job-timeline/actions";
import { createDriverAccessLinkAction } from "@/features/operators/actions";
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
  const assignmentWhatsAppHref = driverUrl
    ? buildWhatsAppHref(phone, buildDriverAssignmentMessage(summary, driverUrl))
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
        {accessStatus !== "disabled" && whatsappHref && !assignmentWhatsAppHref ? (
          <button
            className="driver-job-contact driver-job-contact-whatsapp"
            type="button"
            disabled={pending}
            onClick={createAssignmentLink}
            aria-label={`Búa til öruggan úthlutunartengil fyrir ${summary.driverName}`}
          >
            <Send size={14} /> {pending ? "Bý til tengil…" : "Búa til tengil"}
          </button>
        ) : null}
        {assignmentWhatsAppHref ? (
          <a
            className="driver-job-contact driver-job-contact-whatsapp"
            href={assignmentWhatsAppHref}
            onClick={() => recordContact(jobId, operatorId, "whatsapp", "assignment")}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Senda úthlutun til ${summary.driverName} í WhatsApp`}
          >
            <MessageCircle size={14} /> Senda úthlutun
          </a>
        ) : null}
      </div>
      {accessStatus === "disabled" ? (
        <p>Ökumannsaðgangur er óvirkur.</p>
      ) : assignmentWhatsAppHref ? (
        <p>Öruggi tengillinn er tilbúinn; þú ferð yfir WhatsApp-skilaboðin og ýtir á Senda.</p>
      ) : (
        <p>Býr til einkatengil sem skráir ökumanninn inn í Vegstoð eftir staðfestingu.</p>
      )}
      {error ? <p className="compact-error" role="alert">{error}</p> : null}
    </div>
  );
}
