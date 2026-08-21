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
});
