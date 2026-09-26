import { describe, expect, it, vi } from "vitest";

import { GpsLocationError, requestCustomerPosition } from "./geolocation";

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

function position(latitude: number, longitude: number) {
  return { coords: { latitude, longitude } } as GeolocationPosition;
}

function failure(code: number) {
  return { code, PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT, message: "" } as GeolocationPositionError;
}

function fakeGeolocation(results: Array<GeolocationPosition | GeolocationPositionError>) {
  const calls: PositionOptions[] = [];
  const geolocation = {
    getCurrentPosition: vi.fn((onSuccess: PositionCallback, onError: PositionErrorCallback, options: PositionOptions) => {
      calls.push(options);
      const next = results.shift()!;
      if ("coords" in next) onSuccess(next);
      else onError(next);
    }),
  } as unknown as Geolocation;
  return { calls, geolocation };
}

describe("requestCustomerPosition", () => {
  it("returns a precise position inside Iceland", async () => {
    const { geolocation, calls } = fakeGeolocation([position(64.1209, -21.85)]);

    await expect(requestCustomerPosition(geolocation)).resolves.toEqual({ latitude: 64.1209, longitude: -21.85 });
    expect(calls).toHaveLength(1);
    expect(calls[0].enableHighAccuracy).toBe(true);
  });

  it.each([TIMEOUT, POSITION_UNAVAILABLE])(
    "falls back to a network position when the precise fix fails with code %s",
    async (code) => {
      const { geolocation, calls } = fakeGeolocation([failure(code), position(64.12, -21.85)]);

      await expect(requestCustomerPosition(geolocation)).resolves.toEqual({ latitude: 64.12, longitude: -21.85 });
      expect(calls.map((options) => options.enableHighAccuracy)).toEqual([true, false]);
    },
  );

  it("reports a denied permission without retrying", async () => {
    const { geolocation, calls } = fakeGeolocation([failure(PERMISSION_DENIED)]);

    await expect(requestCustomerPosition(geolocation)).rejects.toMatchObject({ reason: "denied" });
    expect(calls).toHaveLength(1);
  });

  it("reports a timeout when both attempts time out", async () => {
    const { geolocation } = fakeGeolocation([failure(TIMEOUT), failure(TIMEOUT)]);

    await expect(requestCustomerPosition(geolocation)).rejects.toMatchObject({ reason: "timeout" });
  });

  it("rejects a position outside Iceland", async () => {
    const { geolocation } = fakeGeolocation([position(51.5, -0.12)]);

    const error = await requestCustomerPosition(geolocation).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GpsLocationError);
    expect(error).toMatchObject({ reason: "outside_iceland" });
  });

  it("reports an unsupported browser", async () => {
    await expect(requestCustomerPosition(undefined)).rejects.toMatchObject({ reason: "unsupported" });
  });
});
