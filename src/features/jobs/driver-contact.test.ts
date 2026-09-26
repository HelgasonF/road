import { describe, expect, it } from "vitest";

import {
  buildDriverAssignmentMessage,
  buildDriverAvailabilityMessage,
  driverOrigin,
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
  it("builds a privacy-safe availability request with operational summary and distance", () => {
    const message = buildDriverAvailabilityMessage(summary, 42.6);

    expect(message).toContain("Hæ Bjarni Ólafsson");
    expect(message).toContain("Svæði: Hella");
    expect(message).toContain("Aðstoð: Dekkjaskipti, Dráttur");
    expect(message).toContain("Forgangur: Hár");
    expect(message).toContain("Áætluð bein fjarlægð: um 43 km");
    expect(message).toContain("Svaraðu vinsamlega já eða nei");
    expect(message).not.toContain("ökumannsskjá");
  });

  it("omits distance when matching has no geographic result", () => {
    expect(buildDriverAvailabilityMessage(summary, null)).not.toContain("fjarlægð");
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
    expect(buildDriverAvailabilityMessage({ ...summary, locationLabel: "Þingskálar 6, 850" }, 12))
      .not.toContain("Þingskálar 6");
  });

  it("describes a pinned job by area and gives the direction from the driver's base", () => {
    const message = buildDriverAvailabilityMessage(
      { ...summary, locationLabel: "GPS · 63.81000, -20.45650", latitude: 63.81, longitude: -20.4565 },
      42.6,
      { latitude: 64.146, longitude: -21.9422, source: "base" },
    );

    expect(message).toContain("Svæði: Hella, um 4 km SV");
    expect(message).toContain("Áætluð bein fjarlægð: um 43 km SA frá bækistöð þinni");
  });

  it("says the direction is from the driver's current location when that was used", () => {
    const message = buildDriverAvailabilityMessage(
      { ...summary, latitude: 63.81, longitude: -20.4565 },
      42.6,
      { latitude: 64.146, longitude: -21.9422, source: "current" },
    );

    expect(message).toContain("um 43 km SA frá núverandi staðsetningu þinni");
  });

  it("leaves out the direction rather than printing an unknown one", () => {
    const message = buildDriverAvailabilityMessage(summary, 42.6, { latitude: Number.NaN, longitude: -21.9, source: "base" });

    expect(message).toContain("Áætluð bein fjarlægð: um 43 km\n");
    expect(message).not.toContain("undefined");
  });

  it("does not place raw map coordinates in the availability message", () => {
    expect(buildDriverAvailabilityMessage({ ...summary, locationLabel: "Map pin · 63.83531, -20.39852" }, 12))
      .not.toMatch(/\d{2}\.\d{3}/);
  });

  it("measures from the driver's current position when known, like the matching distance", () => {
    expect(driverOrigin({ baseLatitude: 63.8, baseLongitude: -20.4, currentLatitude: 64.1, currentLongitude: -21.9 }))
      .toEqual({ latitude: 64.1, longitude: -21.9, source: "current" });
    expect(driverOrigin({ baseLatitude: 63.8, baseLongitude: -20.4, currentLatitude: null, currentLongitude: null }))
      .toEqual({ latitude: 63.8, longitude: -20.4, source: "base" });
  });
});
