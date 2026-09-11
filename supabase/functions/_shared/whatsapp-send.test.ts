import { describe, expect, it, vi } from "vitest";

import {
  buildWhatsAppTemplatePayload,
  parseWhatsAppTemplateInput,
  payloadSha256,
  sendWhatsAppTemplate,
  WhatsAppSendInputError,
} from "./whatsapp-send";

const input = {
  action: "send_template",
  bodyParameters: ["Bjarni", "Akureyri"],
  buttonUrlSuffix: "driver/token-value",
  customerIntakeLinkId: null,
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  operatorId: "33333333-3333-4333-8333-333333333333",
  purpose: "driver_assignment",
  recipientPhone: "659-7003",
};

describe("WhatsApp template sending", () => {
  it("normalizes an Icelandic local number and validates message references", () => {
    expect(parseWhatsAppTemplateInput(input)).toEqual({
      bodyParameters: ["Bjarni", "Akureyri"],
      buttonUrlSuffix: "driver/token-value",
      customerIntakeLinkId: null,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      jobId: "22222222-2222-4222-8222-222222222222",
      operatorId: "33333333-3333-4333-8333-333333333333",
      purpose: "driver_assignment",
      recipientPhone: "3546597003",
    });
  });

  it.each([
    { ...input, idempotencyKey: "not-a-uuid" },
    { ...input, jobId: null },
    { ...input, recipientPhone: "112" },
    { ...input, bodyParameters: ["x".repeat(1_025)] },
    {
      ...input,
      purpose: "test",
      jobId: null,
      operatorId: null,
      bodyParameters: ["unexpected"],
      buttonUrlSuffix: null,
    },
  ])("rejects an unsafe or inconsistent request", (value) => {
    expect(() => parseWhatsAppTemplateInput(value)).toThrow(WhatsAppSendInputError);
  });

  it("builds Meta template components without retaining them in the ledger shape", async () => {
    const parsed = parseWhatsAppTemplateInput(input);
    const payload = buildWhatsAppTemplatePayload(parsed, {
      language: "is",
      templateName: "driver_assignment_v1",
    });

    expect(payload).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "3546597003",
      type: "template",
      template: {
        name: "driver_assignment_v1",
        language: { code: "is" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Bjarni" },
              { type: "text", text: "Akureyri" },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: "driver/token-value" }],
          },
        ],
      },
    });
    await expect(payloadSha256(payload)).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(payloadSha256(payload)).resolves.toBe(await payloadSha256(payload));
  });

  it("posts a template to the configured Phone Number ID and returns Meta's message ID", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      messaging_product: "whatsapp",
      messages: [{ id: "wamid.accepted-1" }],
    }), { status: 200 }));
    const parsed = parseWhatsAppTemplateInput(input);
    const payload = buildWhatsAppTemplatePayload(parsed, {
      language: "is",
      templateName: "driver_assignment_v1",
    });

    await expect(sendWhatsAppTemplate({
      accessToken: "server-only-token",
      graphApiVersion: "v25.0",
      language: "is",
      phoneNumberId: "1251932438011191",
      templateName: "driver_assignment_v1",
    }, payload, fetcher)).resolves.toEqual({ messageId: "wamid.accepted-1" });

    expect(fetcher).toHaveBeenCalledWith(
      "https://graph.facebook.com/v25.0/1251932438011191/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer server-only-token",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("marks provider 4xx failures as definite and network failures as ambiguous", async () => {
    const rejected = sendWhatsAppTemplate({
      accessToken: "token",
      graphApiVersion: "v25.0",
      language: "en_US",
      phoneNumberId: "123",
      templateName: "hello_world",
    }, {}, vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 131030 },
    }), { status: 400 })));
    await expect(rejected).rejects.toMatchObject({
      deliveryUnknown: false,
      metaCode: "131030",
      status: 400,
    });

    const ambiguous = sendWhatsAppTemplate({
      accessToken: "token",
      graphApiVersion: "v25.0",
      language: "en_US",
      phoneNumberId: "123",
      templateName: "hello_world",
    }, {}, vi.fn().mockRejectedValue(new Error("connection closed")));
    await expect(ambiguous).rejects.toMatchObject({
      deliveryUnknown: true,
      metaCode: null,
      status: 0,
    });
  });
});
