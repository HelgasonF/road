"use client";

import { MessageCircle, PhoneCall, Send } from "lucide-react";
import { useState, useTransition } from "react";

import { recordJobContactAction } from "@/features/job-timeline/actions";
import {
  createAndSendDriverAssignmentWhatsAppAction,
  sendDriverAvailabilityWhatsAppAction,
} from "@/features/whatsapp/actions";
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
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const whatsappHref = buildWhatsAppHref(
    phone,
    buildDriverAvailabilityMessage(summary, distanceKm),
  );

  function sendAvailability() {
    setError(null);
    startTransition(async () => {
      const result = await sendDriverAvailabilityWhatsAppAction({ jobId, operatorId });
      if (!result.ok) {
        setError(result.error ?? "Sjálfvirk WhatsApp-sending mistókst.");
        return;
      }
      setSent(true);
    });
  }

  return (
    <div>
      <div className="driver-job-contact-actions" aria-label={`Hafa samband við ${summary.driverName}`}>
        <DriverCallLink driverName={summary.driverName} jobId={jobId} operatorId={operatorId} phone={phone} purpose="availability" />
        {whatsappHref ? (
          <button
            className="driver-job-contact driver-job-contact-whatsapp"
            type="button"
            disabled={pending || sent}
            onClick={sendAvailability}
            aria-label={`Spyrja ${summary.driverName} um framboð í WhatsApp`}
          >
            <MessageCircle size={14} /> {pending ? "Sendi…" : sent ? "Sent í WhatsApp" : "Spyrja um framboð"}
          </button>
        ) : null}
        {whatsappHref ? (
          <a
            className="driver-job-contact"
            href={whatsappHref}
            onClick={() => recordContact(jobId, operatorId, "whatsapp", "availability")}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Opna handvirka WhatsApp-varaleið fyrir ${summary.driverName}`}
          >
            Handvirkt
          </a>
        ) : null}
      </div>
      {error ? <p className="compact-error" role="alert">{error}</p> : null}
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
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const assignmentWhatsAppHref = driverUrl
    ? buildWhatsAppHref(phone, buildDriverAssignmentMessage(summary, driverUrl))
    : null;

  function createAssignmentLink() {
    setError(null);
    startTransition(async () => {
      const result = await createAndSendDriverAssignmentWhatsAppAction({ jobId, operatorId });
      if (!result.ok || !result.data) {
        setError(result.error ?? "Ekki tókst að búa til ökumannstengil.");
        return;
      }
      setDriverUrl(new URL(result.data.path, window.location.origin).toString());
      setSent(Boolean(result.data.receipt));
      setError(result.data.sendError);
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
            <Send size={14} /> {pending ? "Bý til og sendi…" : "Búa til og senda"}
          </button>
        ) : null}
        {assignmentWhatsAppHref && !sent ? (
          <a
            className="driver-job-contact driver-job-contact-whatsapp"
            href={assignmentWhatsAppHref}
            onClick={() => recordContact(jobId, operatorId, "whatsapp", "assignment")}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Senda úthlutun til ${summary.driverName} í WhatsApp`}
          >
            <MessageCircle size={14} /> Opna WhatsApp handvirkt
          </a>
        ) : null}
      </div>
      {accessStatus === "disabled" ? (
        <p>Ökumannsaðgangur er óvirkur.</p>
      ) : sent ? (
        <p>WhatsApp tók við úthlutuninni og örugga tenglinum.</p>
      ) : assignmentWhatsAppHref ? (
        <p>Öruggi tengillinn er tilbúinn. Opnaðu handvirku varaleiðina og ýttu á Senda.</p>
      ) : (
        <p>Býr til einkatengil sem skráir ökumanninn inn í Vegstoð eftir staðfestingu.</p>
      )}
      {error ? <p className="compact-error" role="alert">{error}</p> : null}
    </div>
  );
}
