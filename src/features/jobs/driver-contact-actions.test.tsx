import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { recordJobContactAction } from "@/features/job-timeline/actions";
import { createDriverAccessLinkAction } from "@/features/operators/actions";

import type { DriverJobContactSummary } from "./driver-contact";
import {
  DriverAssignmentContactActions,
  DriverAvailabilityContactActions,
} from "./driver-contact-actions";

vi.mock("@/features/job-timeline/actions", () => ({
  recordJobContactAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/features/operators/actions", () => ({
  createDriverAccessLinkAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { path: "/driver/access?token_hash=secure-token&type=magiclink" },
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
  it("opens a prewritten availability request for a suggested driver", () => {
    render(
      <DriverAvailabilityContactActions
        distanceKm={42.6}
        jobId={jobId}
        operatorId={operatorId}
        phone="555-0104"
        summary={summary}
      />,
    );

    const link = screen.getByRole("link", { name: "Spyrja Bjarni Ólafsson um framboð í WhatsApp" });
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

    expect(createDriverAccessLinkAction).toHaveBeenCalledWith({ operatorId });
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
