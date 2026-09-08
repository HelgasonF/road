import { FunctionsHttpError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeDriverAccessFunction } from "./driver-access-api";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getSession: mocks.getSession },
    functions: { invoke: mocks.invoke },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "verified-staff-token" } },
    error: null,
  });
});

describe("driver access Edge Function client", () => {
  it("forwards the staff access token and versioned operation contract", async () => {
    mocks.invoke.mockResolvedValue({
      data: { data: { path: "/driver/access?token_hash=secret&type=magiclink" } },
      error: null,
    });

    const result = await invokeDriverAccessFunction<{ path: string }>({
      action: "create_link",
      operatorId: "10000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: true,
      data: { path: "/driver/access?token_hash=secret&type=magiclink" },
    });
    expect(mocks.invoke).toHaveBeenCalledWith("driver-access-v1", {
      body: {
        action: "create_link",
        operatorId: "10000000-0000-4000-8000-000000000001",
      },
      headers: { Authorization: "Bearer verified-staff-token" },
    });
  });

  it("preserves the function error code for the server action", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(
        JSON.stringify({ error: { code: "staff_access_required" } }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      )),
    });

    await expect(invokeDriverAccessFunction({
      action: "set_disabled",
      operatorId: "10000000-0000-4000-8000-000000000001",
      disabled: true,
    })).resolves.toEqual({ ok: false, errorCode: "staff_access_required" });
  });
});
