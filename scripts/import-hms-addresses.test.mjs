import { describe, expect, it } from "vitest";

import { createAddress, createPlace, parseCsvLine } from "./import-hms-addresses.mjs";

describe("HMS and OSM location import", () => {
  it("parses quoted CSV fields without splitting embedded commas", () => {
    expect(parseCsvLine('100,"Bær, gamli","Sagði ""já"""')).toEqual([
      "100",
      "Bær, gamli",
      'Sagði "já"',
    ]);
  });

  it("creates a compact searchable address record", () => {
    expect(createAddress({
      HNITNUM: "10001414",
      N_HNIT_WGS84: "64.09987002",
      E_HNIT_WGS84: "-21.87914013",
      HEITI_NF: "Bæjarlind",
      HEITI_TGF: "Bæjarlind",
      HUSNR: "8",
      BOKST: "",
      VIDSK: "",
      SERHEITI: "",
      POSTNR: "201",
      SVFNR: "1000",
      LANDNR: "177597",
      VEF_BIRTING: "Bæjarlind 8 (177597)",
      DAGS_LEIDR: "2009-02-23",
    })).toMatchObject({
      sourceId: 10001414,
      addressLabel: "Bæjarlind 8, 201",
      latitude: 64.09987002,
      longitude: -21.87914013,
    });
  });

  it("ranks an OSM town as a populated place", () => {
    expect(createPlace({
      type: "node",
      id: 201585514,
      lat: 63.8355038,
      lon: -20.3987009,
      tags: { name: "Hella", place: "town", wikidata: "Q1602650" },
    })).toMatchObject({
      name: "Hella",
      categoryLabel: "þéttbýli",
      searchPriority: 95,
    });
  });
});
