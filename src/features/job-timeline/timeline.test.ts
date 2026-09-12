import { describe, expect, it } from "vitest";

import type { JobTimelineSources } from "./types";
import { buildJobTimeline, formatTimelineDate } from "./timeline";

const sources: JobTimelineSources = {
  job: {
    id: "30000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-20T09:00:00.000Z",
    createdByName: "Anna Dispatcher",
  },
  statusEvents: [
    {
      id: 4,
      fromStatus: "assigned",
      toStatus: "accepted",
      changedAt: "2026-08-20T09:30:00.100Z",
      changedByName: "Bjarni Driver",
      notes: null,
    },
    {
      id: 5,
      fromStatus: "accepted",
      toStatus: "en_route",
      changedAt: "2026-08-20T09:40:00.000Z",
      changedByName: "Bjarni Driver",
      notes: "Lagður af stað",
    },
  ],
  customerLinks: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      createdAt: "2026-08-20T09:03:00.000Z",
      createdByName: "Anna Dispatcher",
      firstOpenedAt: "2026-08-20T09:05:00.000Z",
      expiresAt: "2026-08-21T09:03:00.000Z",
      revokedAt: null,
      submittedAt: "2026-08-20T09:10:00.000Z",
    },
  ],
  photos: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      originalFilename: "front-tyre.jpg",
      uploadedAt: "2026-08-20T09:08:00.000Z",
    },
  ],
  assignments: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      operatorName: "Bjarni Driver",
      vehicleName: "Dráttarbíll 1",
      assignedByName: "Anna Dispatcher",
      assignedAt: "2026-08-20T09:20:00.000Z",
      acceptedAt: "2026-08-20T09:30:00.000Z",
      declinedAt: null,
      declineReason: null,
      unassignedAt: null,
      notes: null,
    },
  ],
  contactEvents: [
    {
      id: 7,
      operatorName: "Bjarni Driver",
      channel: "whatsapp",
      purpose: "availability",
      initiatedByName: "Anna Dispatcher",
      initiatedAt: "2026-08-20T09:15:00.000Z",
    },
  ],
  billingEvents: [
    {
      id: 9,
      action: "issue_payer_invoice",
      changedByName: "Anna Dispatcher",
      changedAt: "2026-08-20T11:00:00.000Z",
      reference: "INV-1001",
      dueAt: "2026-09-01",
      notes: null,
    },
  ],
  whatsappOutbound: [],
  whatsappDeliveries: [],
  whatsappReplies: [],
};

describe("job timeline", () => {
  it("formats Iceland timestamps deterministically", () => {
    expect(formatTimelineDate("2026-08-20T09:05:00.000Z")).toBe("20.08.2026 kl. 09:05");
  });

  it("combines real lifecycle sources in newest-first order", () => {
    const timeline = buildJobTimeline(sources, new Date("2026-08-20T12:00:00.000Z"));

    expect(timeline.map((event) => event.occurredAt)).toEqual([
      "2026-08-20T11:00:00.000Z",
      "2026-08-20T09:40:00.000Z",
      "2026-08-20T09:30:00.000Z",
      "2026-08-20T09:20:00.000Z",
      "2026-08-20T09:15:00.000Z",
      "2026-08-20T09:10:00.000Z",
      "2026-08-20T09:08:00.000Z",
      "2026-08-20T09:05:00.000Z",
      "2026-08-20T09:03:00.000Z",
      "2026-08-20T09:00:00.000Z",
    ]);
    expect(timeline[0]).toMatchObject({ category: "billing", title: "Reikningur gefinn út til greiðanda" });
    expect(timeline.at(-1)).toMatchObject({ category: "job", title: "Verkefni stofnað" });
  });

  it("deduplicates status changes already represented by assignment acceptance", () => {
    const timeline = buildJobTimeline(sources, new Date("2026-08-20T12:00:00.000Z"));

    expect(timeline.filter((event) => event.occurredAt.startsWith("2026-08-20T09:30:00"))).toHaveLength(1);
    expect(timeline.find((event) => event.occurredAt.startsWith("2026-08-20T09:30:00"))).toMatchObject({
      category: "driver",
      title: "Bjarni Driver samþykkti verkefnið",
    });
  });

  it("describes external WhatsApp actions as drafts opened, not messages sent", () => {
    const timeline = buildJobTimeline(sources, new Date("2026-08-20T12:00:00.000Z"));
    const contact = timeline.find((event) => event.id === "contact-7");

    expect(contact).toMatchObject({
      category: "driver",
      title: "WhatsApp-drög opnuð fyrir Bjarni Driver",
      description: "Fyrirspurn um framboð. Vegstoð getur ekki staðfest hvort skilaboðin voru send.",
    });
  });

  it("shows an expired customer link only when it was neither revoked nor submitted", () => {
    const timeline = buildJobTimeline({
      ...sources,
      customerLinks: [{
        ...sources.customerLinks[0],
        firstOpenedAt: null,
        submittedAt: null,
        expiresAt: "2026-08-20T10:00:00.000Z",
      }],
    }, new Date("2026-08-20T12:00:00.000Z"));

    expect(timeline.some((event) => event.id.startsWith("customer-link-expired-"))).toBe(true);
  });

  it("records a decline without also showing the automatic status reset", () => {
    const declinedAt = "2026-08-20T09:31:00.000Z";
    const timeline = buildJobTimeline({
      ...sources,
      assignments: [{
        ...sources.assignments[0],
        acceptedAt: null,
        declinedAt,
        declineReason: "Búnaður ekki tiltækur",
        unassignedAt: declinedAt,
      }],
      statusEvents: [{
        id: 6,
        fromStatus: "assigned",
        toStatus: "new",
        changedAt: "2026-08-20T09:31:00.100Z",
        changedByName: "Bjarni Driver",
        notes: "Búnaður ekki tiltækur",
      }],
    }, new Date("2026-08-20T12:00:00.000Z"));

    expect(timeline.filter((event) => event.occurredAt.startsWith("2026-08-20T09:31:00"))).toHaveLength(1);
    expect(timeline.find((event) => event.occurredAt.startsWith("2026-08-20T09:31:00"))).toMatchObject({
      title: "Bjarni Driver hafnaði verkefninu",
      description: "Búnaður ekki tiltækur",
    });
  });

  it("shows verified WhatsApp delivery and classified driver replies", () => {
    const timeline = buildJobTimeline({
      ...sources,
      whatsappOutbound: [{
        id: "70000000-0000-4000-8000-000000000001",
        purpose: "driver_availability",
        operatorName: "Bjarni Driver",
        state: "read",
        metaMessageId: "wamid.test",
        failureCode: null,
        createdByName: "Anna Dispatcher",
        createdAt: "2026-08-20T09:14:00.000Z",
        acceptedAt: "2026-08-20T09:14:01.000Z",
        updatedAt: "2026-08-20T09:16:00.000Z",
      }],
      whatsappDeliveries: [
        {
          id: 10,
          outboundMessageId: "70000000-0000-4000-8000-000000000001",
          status: "delivered",
          errorCode: null,
          occurredAt: "2026-08-20T09:15:00.000Z",
        },
        {
          id: 11,
          outboundMessageId: "70000000-0000-4000-8000-000000000001",
          status: "read",
          errorCode: null,
          occurredAt: "2026-08-20T09:16:00.000Z",
        },
      ],
      whatsappReplies: [{
        id: "80000000-0000-4000-8000-000000000001",
        operatorName: "Bjarni Driver",
        classification: "available",
        textBody: "Available",
        receivedAt: "2026-08-20T09:17:00.000Z",
      }],
    }, new Date("2026-08-20T12:00:00.000Z"));

    expect(timeline.find((event) => event.id === "whatsapp-delivery-11")).toMatchObject({
      category: "driver",
      title: "Skilaboðin voru lesin í WhatsApp",
      tone: "positive",
    });
    expect(timeline.find((event) => event.id.startsWith("whatsapp-reply-"))).toMatchObject({
      title: "Bjarni Driver svaraði: Laus",
      description: "Available",
      tone: "positive",
    });
  });

  it("shows a provider rejection once when no delivery webhook exists", () => {
    const timeline = buildJobTimeline({
      ...sources,
      whatsappOutbound: [{
        id: "70000000-0000-4000-8000-000000000002",
        purpose: "customer_intake",
        operatorName: null,
        state: "failed",
        metaMessageId: null,
        failureCode: "132001",
        createdByName: "Anna Dispatcher",
        createdAt: "2026-08-20T09:14:00.000Z",
        acceptedAt: null,
        updatedAt: "2026-08-20T09:14:01.000Z",
      }],
    }, new Date("2026-08-20T12:00:00.000Z"));

    expect(timeline.find((event) => event.id.startsWith("whatsapp-failed-"))).toMatchObject({
      category: "customer",
      title: "Sjálfvirk WhatsApp-sending mistókst",
      description: "Villukóði Meta: 132001",
      tone: "danger",
    });
  });
});
