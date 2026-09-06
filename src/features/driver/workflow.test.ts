import { describe, expect, it } from "vitest";

import { buildDirectionsHref, formatDriverTimestamp, getDriverStatusActions } from "./workflow";

describe("driver workflow", () => {
  it("offers only the next safe action for accepted and en-route jobs", () => {
    expect(getDriverStatusActions("accepted")).toEqual([
      { status: "en_route", label: "Leggja af stað" },
    ]);
    expect(getDriverStatusActions("en_route")).toEqual([
      { status: "on_scene", label: "Kominn á staðinn" },
    ]);
  });

  it("makes completion primary while retaining optional work and transport tracking", () => {
    expect(getDriverStatusActions("on_scene")).toEqual([
      { status: "completed", label: "Ljúka verkefni" },
      { status: "in_progress", label: "Skrá vinnu í gangi" },
    ]);
    expect(getDriverStatusActions("in_progress")).toEqual([
      { status: "completed", label: "Ljúka verkefni" },
      { status: "transporting", label: "Skrá flutning" },
    ]);
  });

  it("does not offer driver transitions before acceptance or after closure", () => {
    expect(getDriverStatusActions("assigned")).toEqual([]);
    expect(getDriverStatusActions("completed")).toEqual([]);
    expect(getDriverStatusActions("cancelled")).toEqual([]);
  });

  it("builds a navigation URL from the incident coordinates", () => {
    expect(buildDirectionsHref(64.1466, -21.9426)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=64.1466%2C-21.9426",
    );
  });

  it("formats assignment time identically on the server and browser", () => {
    expect(formatDriverTimestamp("2026-08-20T19:07:00Z")).toBe("20.08. kl. 19:07");
  });
});
