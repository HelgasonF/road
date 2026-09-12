import { billingActionLabels } from "@/features/billing/labels";
import { jobStatusLabels } from "@/lib/i18n/is";
import type { JobContactChannel, JobContactPurpose, JobStatus } from "@/lib/domain/types";
import type {
  JobTimelineEvent,
  JobTimelineSources,
  JobTimelineTone,
} from "./types";

const DUPLICATE_WINDOW_MS = 1_500;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatTimelineDate(value: string) {
  const date = new Date(value);
  return `${padDatePart(date.getUTCDate())}.${padDatePart(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} kl. ${padDatePart(date.getUTCHours())}:${padDatePart(date.getUTCMinutes())}`;
}

function isNear(left: string, right: string | null) {
  if (!right) return false;
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= DUPLICATE_WINDOW_MS;
}

function statusTone(status: JobStatus): JobTimelineTone {
  if (status === "completed") return "positive";
  if (status === "cancelled") return "danger";
  if (status === "new" || status === "assigned") return "warning";
  return "neutral";
}

function contactCopy(
  operatorName: string,
  channel: JobContactChannel,
  purpose: JobContactPurpose,
): Pick<JobTimelineEvent, "title" | "description"> {
  const purposeCopy = purpose === "availability"
    ? "Fyrirspurn um framboð"
    : "Úthlutun og innskráningarhlekkur";

  if (channel === "whatsapp") {
    return {
      title: `WhatsApp-drög opnuð fyrir ${operatorName}`,
      description: `${purposeCopy}. Vegstoð getur ekki staðfest hvort skilaboðin voru send.`,
    };
  }

  return {
    title: `Símatengill opnaður fyrir ${operatorName}`,
    description: `${purposeCopy}. Vegstoð getur ekki staðfest hvort símtalið tengdist.`,
  };
}

function billingDescription(event: JobTimelineSources["billingEvents"][number]) {
  const parts = [
    event.reference ? `Tilvísun: ${event.reference}` : null,
    event.dueAt ? `Gjalddagi: ${event.dueAt}` : null,
    event.notes,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function whatsappCategory(purpose: JobTimelineSources["whatsappOutbound"][number]["purpose"]): JobTimelineEvent["category"] {
  return purpose === "customer_intake" ? "customer" : "driver";
}

function whatsappPurposeCopy(event: JobTimelineSources["whatsappOutbound"][number]) {
  if (event.purpose === "customer_intake") return "upplýsingatengill viðskiptavinar";
  const operator = event.operatorName ?? "þjónustuaðila";
  if (event.purpose === "driver_availability") return `framboðsfyrirspurn til ${operator}`;
  if (event.purpose === "driver_assignment") return `úthlutun og ökumannstengill til ${operator}`;
  return "prófskilaboð";
}

function whatsappDeliveryTitle(status: JobTimelineSources["whatsappDeliveries"][number]["status"]) {
  if (status === "sent") return "WhatsApp sendi skilaboðin";
  if (status === "delivered") return "WhatsApp afhenti skilaboðin í síma";
  if (status === "read") return "Skilaboðin voru lesin í WhatsApp";
  return "WhatsApp gat ekki afhent skilaboðin";
}

export function buildJobTimeline(sources: JobTimelineSources, now = new Date()): JobTimelineEvent[] {
  const events: JobTimelineEvent[] = [{
    id: `job-created-${sources.job.id}`,
    category: "job",
    title: "Verkefni stofnað",
    description: null,
    actorName: sources.job.createdByName,
    occurredAt: sources.job.createdAt,
    tone: "neutral",
  }];

  for (const link of sources.customerLinks) {
    events.push({
      id: `customer-link-created-${link.id}`,
      category: "customer",
      title: "Öruggur viðskiptavinatengill búinn til",
      description: null,
      actorName: link.createdByName,
      occurredAt: link.createdAt,
      tone: "neutral",
    });

    if (link.firstOpenedAt) {
      events.push({
        id: `customer-link-opened-${link.id}`,
        category: "customer",
        title: "Viðskiptavinur opnaði tengilinn",
        description: null,
        actorName: null,
        occurredAt: link.firstOpenedAt,
        tone: "neutral",
      });
    }

    if (link.submittedAt) {
      events.push({
        id: `customer-link-submitted-${link.id}`,
        category: "customer",
        title: "Upplýsingar viðskiptavinar mótteknar",
        description: "Staðsetning, upplýsingar um ökutæki og lýsing voru send til aðgerðastjórnar.",
        actorName: null,
        occurredAt: link.submittedAt,
        tone: "positive",
      });
    } else if (link.revokedAt) {
      events.push({
        id: `customer-link-revoked-${link.id}`,
        category: "customer",
        title: "Viðskiptavinatengill afturkallaður",
        description: null,
        actorName: null,
        occurredAt: link.revokedAt,
        tone: "warning",
      });
    } else if (new Date(link.expiresAt).getTime() <= now.getTime()) {
      events.push({
        id: `customer-link-expired-${link.id}`,
        category: "customer",
        title: "Viðskiptavinatengill rann út",
        description: null,
        actorName: null,
        occurredAt: link.expiresAt,
        tone: "warning",
      });
    }
  }

  for (const photo of sources.photos) {
    events.push({
      id: `photo-${photo.id}`,
      category: "customer",
      title: "Mynd móttekin frá viðskiptavini",
      description: photo.originalFilename,
      actorName: null,
      occurredAt: photo.uploadedAt,
      tone: "positive",
    });
  }

  for (const assignment of sources.assignments) {
    events.push({
      id: `assignment-created-${assignment.id}`,
      category: "driver",
      title: `Verkefni úthlutað til ${assignment.operatorName}`,
      description: [assignment.vehicleName, assignment.notes].filter(Boolean).join(" · ") || null,
      actorName: assignment.assignedByName,
      occurredAt: assignment.assignedAt,
      tone: "neutral",
    });

    if (assignment.acceptedAt) {
      events.push({
        id: `assignment-accepted-${assignment.id}`,
        category: "driver",
        title: `${assignment.operatorName} samþykkti verkefnið`,
        description: null,
        actorName: assignment.operatorName,
        occurredAt: assignment.acceptedAt,
        tone: "positive",
      });
    }

    if (assignment.declinedAt) {
      events.push({
        id: `assignment-declined-${assignment.id}`,
        category: "driver",
        title: `${assignment.operatorName} hafnaði verkefninu`,
        description: assignment.declineReason,
        actorName: assignment.operatorName,
        occurredAt: assignment.declinedAt,
        tone: "danger",
      });
    }

    if (assignment.unassignedAt && !isNear(assignment.unassignedAt, assignment.declinedAt)) {
      events.push({
        id: `assignment-ended-${assignment.id}`,
        category: "driver",
        title: `Úthlutun til ${assignment.operatorName} lauk`,
        description: null,
        actorName: null,
        occurredAt: assignment.unassignedAt,
        tone: "warning",
      });
    }
  }

  for (const contact of sources.contactEvents) {
    const copy = contactCopy(contact.operatorName, contact.channel, contact.purpose);
    events.push({
      id: `contact-${contact.id}`,
      category: "driver",
      ...copy,
      actorName: contact.initiatedByName,
      occurredAt: contact.initiatedAt,
      tone: "neutral",
    });
  }

  for (const outbound of sources.whatsappOutbound) {
    const category = whatsappCategory(outbound.purpose);
    const purpose = whatsappPurposeCopy(outbound);
    events.push({
      id: `whatsapp-requested-${outbound.id}`,
      category,
      title: `WhatsApp-sending útbúin: ${purpose}`,
      description: null,
      actorName: outbound.createdByName,
      occurredAt: outbound.createdAt,
      tone: "neutral",
    });

    if (outbound.acceptedAt) {
      events.push({
        id: `whatsapp-accepted-${outbound.id}`,
        category,
        title: "WhatsApp tók við skilaboðunum",
        description: purpose,
        actorName: null,
        occurredAt: outbound.acceptedAt,
        tone: "neutral",
      });
    }

    const hasFailedDelivery = sources.whatsappDeliveries.some((delivery) => (
      delivery.outboundMessageId === outbound.id && delivery.status === "failed"
    ));
    if (outbound.state === "failed" && !hasFailedDelivery) {
      events.push({
        id: `whatsapp-failed-${outbound.id}`,
        category,
        title: "Sjálfvirk WhatsApp-sending mistókst",
        description: outbound.failureCode ? `Villukóði Meta: ${outbound.failureCode}` : purpose,
        actorName: null,
        occurredAt: outbound.updatedAt,
        tone: "danger",
      });
    } else if (outbound.state === "delivery_unknown") {
      events.push({
        id: `whatsapp-unknown-${outbound.id}`,
        category,
        title: "Óvíst er hvort WhatsApp tók við sendingunni",
        description: "Yfirfara þarf stöðuna áður en reynt er aftur.",
        actorName: null,
        occurredAt: outbound.updatedAt,
        tone: "warning",
      });
    }
  }

  for (const delivery of sources.whatsappDeliveries) {
    const outbound = sources.whatsappOutbound.find((item) => item.id === delivery.outboundMessageId);
    if (!outbound) continue;
    events.push({
      id: `whatsapp-delivery-${delivery.id}`,
      category: whatsappCategory(outbound.purpose),
      title: whatsappDeliveryTitle(delivery.status),
      description: delivery.errorCode ? `Villukóði Meta: ${delivery.errorCode}` : whatsappPurposeCopy(outbound),
      actorName: null,
      occurredAt: delivery.occurredAt,
      tone: delivery.status === "failed"
        ? "danger"
        : delivery.status === "delivered" || delivery.status === "read"
          ? "positive"
          : "neutral",
    });
  }

  for (const reply of sources.whatsappReplies) {
    const title = reply.classification === "available"
      ? `${reply.operatorName ?? "Þjónustuaðili"} svaraði: Laus`
      : reply.classification === "unavailable"
        ? `${reply.operatorName ?? "Þjónustuaðili"} svaraði: Ekki laus`
        : reply.operatorName
          ? `${reply.operatorName} svaraði í WhatsApp`
          : "Svar barst í WhatsApp";
    events.push({
      id: `whatsapp-reply-${reply.id}`,
      category: reply.operatorName ? "driver" : "customer",
      title,
      description: reply.textBody,
      actorName: reply.operatorName,
      occurredAt: reply.receivedAt,
      tone: reply.classification === "available"
        ? "positive"
        : reply.classification === "unavailable"
          ? "warning"
          : "neutral",
    });
  }

  for (const statusEvent of sources.statusEvents) {
    const assignmentDuplicate = sources.assignments.some((assignment) => (
      (statusEvent.toStatus === "assigned" && isNear(statusEvent.changedAt, assignment.assignedAt))
      || (statusEvent.toStatus === "accepted" && isNear(statusEvent.changedAt, assignment.acceptedAt))
      || (statusEvent.toStatus === "new" && isNear(statusEvent.changedAt, assignment.declinedAt))
    ));
    if (assignmentDuplicate) continue;

    const transition = statusEvent.fromStatus
      ? `Úr „${jobStatusLabels[statusEvent.fromStatus]}“`
      : null;
    const description = [transition, statusEvent.notes].filter(Boolean).join(" · ") || null;
    events.push({
      id: `status-${statusEvent.id}`,
      category: "job",
      title: `Staða færð í „${jobStatusLabels[statusEvent.toStatus]}“`,
      description,
      actorName: statusEvent.changedByName,
      occurredAt: statusEvent.changedAt,
      tone: statusTone(statusEvent.toStatus),
    });
  }

  for (const billingEvent of sources.billingEvents) {
    events.push({
      id: `billing-${billingEvent.id}`,
      category: "billing",
      title: billingActionLabels[billingEvent.action],
      description: billingDescription(billingEvent),
      actorName: billingEvent.changedByName,
      occurredAt: billingEvent.changedAt,
      tone: billingEvent.action === "void_billing" || billingEvent.action.startsWith("dispute_")
        ? "danger"
        : billingEvent.action === "refund_payer" || billingEvent.action.startsWith("reopen_")
          ? "warning"
          : billingEvent.action === "record_payer_payment" || billingEvent.action === "record_provider_payment"
            ? "positive"
            : "neutral",
    });
  }

  return events.sort((left, right) => (
    right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id)
  ));
}
