import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DriverJobContactSummary } from "./driver-contact";
import {
  DriverAssignmentContactActions,
  DriverAvailabilityContactActions,
} from "./driver-contact-actions";

const summary: DriverJobContactSummary = {
  driverName: "Bjarni Ólafsson",
  locationLabel: "Hella",
  priority: "high",
  requiredCapabilities: ["tire_assistance"],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("driver job contact actions", () => {
  it("opens a prewritten availability request for a suggested driver", () => {
    render(
      <DriverAvailabilityContactActions
        distanceKm={42.6}
        phone="555-0104"
        summary={summary}
      />,
    );

    const link = screen.getByRole("link", { name: "Spyrja Bjarni Ólafsson um framboð í WhatsApp" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.pathname).toBe("/3545550104");
    expect(url.searchParams.get("text")).toContain("Svæði: Hella");
  });

  it("builds the absolute driver URL only when dispatch opens the post-assignment message", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <DriverAssignmentContactActions
        accessStatus="active"
        phone="555-0104"
        summary={summary}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Senda úthlutun til Bjarni Ólafsson í WhatsApp" }));

    const href = String(open.mock.calls[0]?.[0]);
    const message = new URL(href).searchParams.get("text");
    expect(message).toContain("http://localhost:3000/driver");
    expect(message).toContain("Verkefninu hefur verið úthlutað");
  });

  it("does not offer a login link while driver access is disabled", () => {
    render(
      <DriverAssignmentContactActions
        accessStatus="disabled"
        phone="555-0104"
        summary={summary}
      />,
    );

    expect(screen.queryByRole("button", { name: /Senda úthlutun/ })).not.toBeInTheDocument();
    expect(screen.getByText("Ökumannsaðgangur er óvirkur.")).toBeInTheDocument();
  });
});
