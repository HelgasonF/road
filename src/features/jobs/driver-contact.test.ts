import { describe, expect, it } from "vitest";

import {
  buildDriverAssignmentMessage,
  buildDriverAvailabilityMessage,
  type DriverJobContactSummary,
} from "./driver-contact";

const summary: DriverJobContactSummary = {
  driverName: "Bjarni Ólafsson",
  locationLabel: "Hella",
  latitude: 63.8355,
  longitude: -20.3987,
  priority: "high",
  requiredCapabilities: ["tire_assistance", "towing"],
};

describe("driver WhatsApp messages", () => {
  it("builds a privacy-safe availability request without a distance line", () => {
    const message = buildDriverAvailabilityMessage(summary);

    expect(message).toContain("Hæ Bjarni Ólafsson");
    expect(message).toContain("Svæði: Hella");
    expect(message).toContain("Aðstoð: Dekkjaskipti, Dráttur");
    expect(message).toContain("Forgangur: Hár");
    expect(message).toContain("Svaraðu vinsamlega já eða nei");
    expect(message).not.toContain("fjarlægð");
    expect(message).not.toContain("ökumannsskjá");
  });

  it("adds the driver login only to the post-assignment message", () => {
    const message = buildDriverAssignmentMessage(
      summary,
      "https://dispatch.vegstod.is/driver/access?token_hash=secret",
    );

    expect(message).toContain("Verkefninu hefur verið úthlutað til þín");
    expect(message).toContain("Opnaðu örugga tengilinn til að sjá nákvæma staðsetningu og upplýsingar viðskiptavinar");
    expect(message).toContain("https://dispatch.vegstod.is/driver/access?token_hash=secret");
    expect(message).toContain("Ekki framsenda tengilinn");
  });

  it("reduces an exact address to an area before assignment", () => {
    expect(buildDriverAvailabilityMessage({ ...summary, locationLabel: "Þingskálar 6, 850" }))
      .not.toContain("Þingskálar 6");
  });

  it("describes a pinned job by area", () => {
    const message = buildDriverAvailabilityMessage(
      { ...summary, locationLabel: "GPS · 63.81000, -20.45650", latitude: 63.81, longitude: -20.4565 },
    );

    expect(message).toContain("Svæði: Hella, um 4 km SV");
    expect(message).not.toContain("fjarlægð");
  });

  it("does not place raw map coordinates in the availability message", () => {
    expect(buildDriverAvailabilityMessage({ ...summary, locationLabel: "Map pin · 63.83531, -20.39852" }))
      .not.toMatch(/\d{2}\.\d{3}/);
  });
});
