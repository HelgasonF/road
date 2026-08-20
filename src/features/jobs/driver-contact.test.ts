import { describe, expect, it } from "vitest";

import {
  buildDriverAssignmentMessage,
  buildDriverAvailabilityMessage,
  toDriverContactArea,
  type DriverJobContactSummary,
} from "./driver-contact";

const summary: DriverJobContactSummary = {
  driverName: "Bjarni Ólafsson",
  locationLabel: "Hella",
  priority: "high",
  requiredCapabilities: ["tire_assistance", "towing"],
};

describe("driver WhatsApp messages", () => {
  it("builds a privacy-safe availability request with operational summary and distance", () => {
    const message = buildDriverAvailabilityMessage(summary, 42.6);

    expect(message).toContain("Hæ Bjarni Ólafsson");
    expect(message).toContain("Svæði: Hella");
    expect(message).toContain("Aðstoð: Dekkjaskipti, Dráttur");
    expect(message).toContain("Forgangur: Hár");
    expect(message).toContain("Áætluð bein fjarlægð: 42,6 km");
    expect(message).toContain("Svaraðu vinsamlega já eða nei");
    expect(message).not.toContain("ökumannsskjá");
  });

  it("omits distance when matching has no geographic result", () => {
    expect(buildDriverAvailabilityMessage(summary, null)).not.toContain("fjarlægð");
  });

  it("adds the driver login only to the post-assignment message", () => {
    const message = buildDriverAssignmentMessage(summary, "https://dispatch.vegstod.is/driver");

    expect(message).toContain("Verkefninu hefur verið úthlutað til þín");
    expect(message).toContain("Skráðu þig inn til að sjá nákvæma staðsetningu og upplýsingar viðskiptavinar");
    expect(message).toContain("https://dispatch.vegstod.is/driver");
  });

  it("reduces an exact address to an area before assignment", () => {
    expect(toDriverContactArea("Þingskálar 6, 850")).toBe("Þingskálar, 850");
    expect(buildDriverAvailabilityMessage({ ...summary, locationLabel: "Þingskálar 6, 850" }, 12))
      .not.toContain("Þingskálar 6");
  });

  it("does not place raw map coordinates in the availability message", () => {
    expect(toDriverContactArea("Map pin · 63.83531, -20.39852"))
      .toBe("Staðsetning skráð á korti");
  });
});
