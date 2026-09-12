import { FunctionsHttpError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeWhatsAppSendFunction } from "./send-api";

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

describe("WhatsApp send Edge Function client", () => {
  it("forwards the staff token and returns the constrained receipt", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        data: {
          deduplicated: false,
          messageId: "70000000-0000-4000-8000-000000000001",
          metaMessageId: "wamid.test",
          state: "accepted",
        },
      },
      error: null,
    });
    const request = {
      action: "send_template" as const,
      idempotencyKey: "80000000-0000-4000-8000-000000000001",
      jobId: "30000000-0000-4000-8000-000000000001",
      operatorId: "10000000-0000-4000-8000-000000000001",
      purpose: "driver_availability" as const,
      recipientPhone: "5550104",
      bodyParameters: ["Jón", "Hella", "Dráttur", "Venjulegur", "12 km"],
    };

    await expect(invokeWhatsAppSendFunction(request)).resolves.toEqual({
      ok: true,
      data: {
        deduplicated: false,
        messageId: "70000000-0000-4000-8000-000000000001",
        metaMessageId: "wamid.test",
        state: "accepted",
      },
    });
    expect(mocks.invoke).toHaveBeenCalledWith("whatsapp-send-v1", {
      body: request,
      headers: { Authorization: "Bearer verified-staff-token" },
    });
  });

  it("keeps the function error code for manual fallback handling", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(
        JSON.stringify({ error: { code: "whatsapp_provider_rejected" } }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      )),
    });

    await expect(invokeWhatsAppSendFunction({
      action: "send_template",
      idempotencyKey: "80000000-0000-4000-8000-000000000001",
      purpose: "test",
      recipientPhone: "5550104",
    })).resolves.toEqual({ ok: false, errorCode: "whatsapp_provider_rejected" });
  });
});
