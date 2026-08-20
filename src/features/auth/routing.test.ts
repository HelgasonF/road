import { describe, expect, it } from "vitest";

import type { AuthenticatedIdentity } from "@/lib/domain/types";
import { getAuthenticatedLandingPath } from "./routing";

function identity(overrides: Partial<AuthenticatedIdentity>): AuthenticatedIdentity {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "user@vegstod.local",
    displayName: "Notandi",
    role: "pending",
    operatorId: null,
    ...overrides,
  };
}

describe("getAuthenticatedLandingPath", () => {
  it("routes linked drivers to the driver workspace", () => {
    expect(getAuthenticatedLandingPath(identity({ role: "driver", operatorId: "operator-1" }))).toBe("/driver");
  });

  it("does not redirect a disabled or unlinked driver away from login", () => {
    expect(getAuthenticatedLandingPath(identity({ role: "driver", operatorId: null }))).toBeNull();
  });

  it("routes staff to dispatch and leaves pending users blocked", () => {
    expect(getAuthenticatedLandingPath(identity({ role: "admin" }))).toBe("/");
    expect(getAuthenticatedLandingPath(identity({ role: "dispatcher" }))).toBe("/");
    expect(getAuthenticatedLandingPath(identity({ role: "pending" }))).toBeNull();
  });
});
