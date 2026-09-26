import { describe, expect, it } from "vitest";

import { compassDirection, describeDriverArea } from "./driver-area";

describe("compassDirection", () => {
  it.each([
    [64.2, -20.0, "N"],
    [64.1, -19.8, "NA"],
    [64.0, -19.8, "A"],
    [63.9, -19.8, "SA"],
    [63.8, -20.0, "S"],
    [63.9, -20.2, "SV"],
    [64.0, -20.2, "V"],
    [64.1, -20.2, "NV"],
  ])("points from the origin towards %s, %s as %s", (latitude, longitude, expected) => {
    expect(compassDirection({ latitude: 64.0, longitude: -20.0 }, { latitude, longitude })).toBe(expected);
  });
});

describe("describeDriverArea", () => {
  it("names the town when the pin is inside it", () => {
    expect(describeDriverArea({ locationLabel: "GPS · 63.83550, -20.39870", latitude: 63.8355, longitude: -20.3987 }))
      .toBe("Hella");
  });

  it("gives distance and direction from a nearby town", () => {
    expect(describeDriverArea({ locationLabel: "Map pin · 63.81000, -20.45650", latitude: 63.81, longitude: -20.4565 }))
      .toBe("Hella, um 4 km SV");
  });

  it("uses a known highland reference point instead of a distant town", () => {
    expect(describeDriverArea({ locationLabel: "GPS · 64.29260, -19.05940", latitude: 64.2926, longitude: -19.0594 }))
      .toBe("Hálendi – Hrauneyjar, um 15 km NA");
  });

  it("names a highland reference point directly when the pin is at it", () => {
    expect(describeDriverArea({ locationLabel: "GPS · 64.86700, -19.55500", latitude: 64.867, longitude: -19.555 }))
      .toBe("Hálendi – Hveravellir");
  });

  it("marks remote lowland jobs and falls back to the nearest town", () => {
    expect(describeDriverArea({ locationLabel: "Map pin · 65.20000, -20.20000", latitude: 65.2, longitude: -20.2 }))
      .toMatch(/^Utan þéttbýlis – Hvammstangi, um \d+ km SA$/);
  });

  it.each([
    ["Ártúnshöfði", 64.1261, -21.8417, /^Reykjavík – /],
    ["Vellir", 64.0475, -21.975, /^Hafnarfjörður – Vellir$/],
    ["Glerárhverfi edge", 65.6938, -18.1106, /^Akureyri – Holtahverfi$/],
  ])("names the town and district inside a city: %s", (_place, latitude, longitude, expected) => {
    expect(describeDriverArea({ locationLabel: "GPS · x", latitude, longitude })).toMatch(expected);
  });

  it("flags the Kjölur road as highland even when Gullfoss is the closest known place", () => {
    expect(describeDriverArea({ locationLabel: "GPS · x", latitude: 64.45, longitude: -19.95 }))
      .toMatch(/^Hálendi – Gullfoss, um \d+ km NA$/);
  });

  it("does not flag a lowland site next to the highland edge", () => {
    expect(describeDriverArea({ locationLabel: "GPS · x", latitude: 63.527, longitude: -19.511 }))
      .toBe("Utan þéttbýlis – Skógar");
  });

  it("flags the pass above Skógar as highland", () => {
    expect(describeDriverArea({ locationLabel: "GPS · x", latitude: 63.62, longitude: -19.44 }))
      .toMatch(/^Hálendi – /);
  });

  it("keeps the privacy-reduced typed address when there is one", () => {
    expect(describeDriverArea({ locationLabel: "Þingskálar 6, 850", latitude: 63.8355, longitude: -20.3987 }))
      .toBe("Þingskálar, 850");
  });

  it("never exposes raw coordinates", () => {
    const area = describeDriverArea({ locationLabel: "GPS · 64.29260, -19.05940", latitude: 64.2926, longitude: -19.0594 });
    expect(area).not.toMatch(/\d{2}\.\d{3}/);
  });
});
