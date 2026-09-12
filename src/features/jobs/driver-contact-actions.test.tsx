import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { recordJobContactAction } from "@/features/job-timeline/actions";
import {
  createAndSendDriverAssignmentWhatsAppAction,
  sendDriverAvailabilityWhatsAppAction,
} from "@/features/whatsapp/actions";

import type { DriverJobContactSummary } from "./driver-contact";
import {
  DriverAssignmentContactActions,
  DriverAvailabilityContactActions,
} from "./driver-contact-actions";

vi.mock("@/features/job-timeline/actions", () => ({
  recordJobContactAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/features/whatsapp/actions", () => ({
  sendDriverAvailabilityWhatsAppAction: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      receipt: {
        deduplicated: false,
        messageId: "70000000-0000-4000-8000-000000000001",
        metaMessageId: "wamid.availability",
        state: "accepted",
      },
    },
  }),
  createAndSendDriverAssignmentWhatsAppAction: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      path: "/driver/access?token_hash=secure-token&type=magiclink",
      receipt: null,
      sendError: "Template pending.",
    },
  }),
}));

const jobId = "30000000-0000-4000-8000-000000000001";
const operatorId = "10000000-0000-4000-8000-000000000001";

const summary: DriverJobContactSummary = {
  driverName: "Bjarni Ólafsson",
  locationLabel: "Hella",
  priority: "high",
  requiredCapabilities: ["tire_assistance"],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("driver job contact actions", () => {
  it("sends availability through the API and hides the fallback after provider acceptance", async () => {
    render(
      <DriverAvailabilityContactActions
        distanceKm={42.6}
        jobId={jobId}
        operatorId={operatorId}
        phone="555-0104"
        summary={summary}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Spyrja Bjarni Ólafsson um framboð í WhatsApp" }));
    expect(sendDriverAvailabilityWhatsAppAction).toHaveBeenCalledWith({ jobId, operatorId });
    expect(await screen.findByText("Sent í WhatsApp")).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: "Opna handvirka WhatsApp-varaleið fyrir Bjarni Ólafsson" })).not.toBeInTheDocument();
  });

  it("records use of the manual availability fallback without calling the API", () => {
    render(
      <DriverAvailabilityContactActions
        distanceKm={42.6}
        jobId={jobId}
        operatorId={operatorId}
        phone="555-0104"
        summary={summary}
      />,
    );

    const link = screen.getByRole("link", { name: "Opna handvirka WhatsApp-varaleið fyrir Bjarni Ólafsson" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.pathname).toBe("/3545550104");
    expect(url.searchParams.get("text")).toContain("Svæði: Hella");

    fireEvent.click(link);
    expect(recordJobContactAction).toHaveBeenCalledWith({
      jobId,
      operatorId,
      channel: "whatsapp",
      purpose: "availability",
    });
    expect(sendDriverAvailabilityWhatsAppAction).not.toHaveBeenCalled();
  });

  it("generates a private driver link before offering the post-assignment WhatsApp message", async () => {
    render(
      <DriverAssignmentContactActions
        accessStatus="active"
        jobId={jobId}
        operatorId={operatorId}
        phone="555-0104"
        summary={summary}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Búa til öruggan úthlutunartengil fyrir Bjarni Ólafsson" }));

    expect(createAndSendDriverAssignmentWhatsAppAction).toHaveBeenCalledWith({ jobId, operatorId });
    const link = await screen.findByRole("link", { name: "Senda úthlutun til Bjarni Ólafsson í WhatsApp" });

    const href = link.getAttribute("href")!;
    const message = new URL(href).searchParams.get("text");
    expect(message).toContain("http://localhost:3000/driver/access?token_hash=secure-token&type=magiclink");
    expect(message).toContain("Verkefninu hefur verið úthlutað");

    fireEvent.click(link);
    expect(recordJobContactAction).toHaveBeenCalledWith({
      jobId,
      operatorId,
      channel: "whatsapp",
      purpose: "assignment",
    });
  });

  it("does not offer a login link while driver access is disabled", () => {
    render(
      <DriverAssignmentContactActions
        accessStatus="disabled"
        jobId={jobId}
        operatorId={operatorId}
        phone="555-0104"
        summary={summary}
      />,
    );

    expect(screen.queryByRole("button", { name: /Búa til öruggan úthlutunartengil/ })).not.toBeInTheDocument();
    expect(screen.getByText("Ökumannsaðgangur er óvirkur.")).toBeInTheDocument();
  });
});
