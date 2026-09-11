import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createWhatsAppWebhookHandler } from "./whatsapp-webhook";

const verifyToken = "a-long-random-webhook-verification-token";
const appSecret = "meta-app-secret-for-tests";

function signedRequest(payload: unknown, overrides: RequestInit = {}) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", appSecret).update(body).digest("hex");

  return new Request("https://example.test/functions/v1/whatsapp-webhook-v1", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": `sha256=${signature}`,
    },
    ...overrides,
  });
}

describe("WhatsApp webhook handler", () => {
  it("returns Meta's challenge for a matching verification token", async () => {
    const handler = createWhatsAppWebhookHandler({
      getVerifyToken: () => verifyToken,
      getAppSecret: () => appSecret,
      persistEvent: vi.fn(),
    });
    const url = new URL("https://example.test/functions/v1/whatsapp-webhook-v1");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", verifyToken);
    url.searchParams.set("hub.challenge", "482193");

    const response = await handler(new Request(url));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("482193");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects an incorrect verification token", async () => {
    const handler = createWhatsAppWebhookHandler({
      getVerifyToken: () => verifyToken,
      getAppSecret: () => appSecret,
      persistEvent: vi.fn(),
    });
    const url = new URL("https://example.test/functions/v1/whatsapp-webhook-v1");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "wrong-token");
    url.searchParams.set("hub.challenge", "482193");

    const response = await handler(new Request(url));

    expect(response.status).toBe(403);
  });

  it("authenticates and persists a signed WhatsApp event", async () => {
    const persistEvent = vi.fn().mockResolvedValue(undefined);
    const handler = createWhatsAppWebhookHandler({
      getVerifyToken: () => verifyToken,
      getAppSecret: () => appSecret,
      persistEvent,
    });
    const payload = {
      object: "whatsapp_business_account",
      entry: [{ id: "1799725827819599", changes: [] }],
    };

    const response = await handler(signedRequest(payload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(persistEvent).toHaveBeenCalledOnce();
    expect(persistEvent).toHaveBeenCalledWith({
      messages: [],
      payload,
      payloadSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      statuses: [],
      wabaId: "1799725827819599",
    });
  });

  it("normalizes delivery timestamps and inbound driver replies from every entry", async () => {
    const persistEvent = vi.fn().mockResolvedValue(undefined);
    const handler = createWhatsAppWebhookHandler({
      getVerifyToken: () => verifyToken,
      getAppSecret: () => appSecret,
      persistEvent,
    });
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "1799725827819599",
          changes: [{
            field: "messages",
            value: {
              metadata: { phone_number_id: "1251932438011191" },
              statuses: [{
                id: "wamid.outbound-1",
                recipient_id: "3546907704",
                status: "delivered",
                timestamp: "1789164000",
              }],
              messages: [{
                context: { id: "wamid.outbound-1" },
                from: "3546907704",
                id: "wamid.inbound-1",
                text: { body: "Ekki laus!" },
                timestamp: "1789164060",
                type: "text",
              }],
            },
          }],
        },
        {
          id: "1799725827819599",
          changes: [{
            field: "messages",
            value: {
              metadata: { phone_number_id: "1251932438011191" },
              messages: [{
                from: "3546907704",
                id: "wamid.inbound-2",
                interactive: {
                  button_reply: { id: "driver_available", title: "Laus" },
                  type: "button_reply",
                },
                timestamp: "1789164120",
                type: "interactive",
              }],
            },
          }],
        },
      ],
    };

    const response = await handler(signedRequest(payload));

    expect(response.status).toBe(200);
    expect(persistEvent).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        {
          contextMessageId: "wamid.outbound-1",
          messageId: "wamid.inbound-1",
          messageType: "text",
          occurredAt: "2026-09-11T22:01:00.000Z",
          phoneNumberId: "1251932438011191",
          replyClassification: "unavailable",
          senderPhone: "3546907704",
          textBody: "Ekki laus!",
        },
        {
          contextMessageId: null,
          messageId: "wamid.inbound-2",
          messageType: "interactive",
          occurredAt: "2026-09-11T22:02:00.000Z",
          phoneNumberId: "1251932438011191",
          replyClassification: "available",
          senderPhone: "3546907704",
          textBody: "Laus",
        },
      ],
      statuses: [{
        errorCode: null,
        messageId: "wamid.outbound-1",
        occurredAt: "2026-09-11T22:00:00.000Z",
        recipientPhone: "3546907704",
        status: "delivered",
      }],
    }));
  });

  it("drops malformed normalized items while retaining their signed envelope", async () => {
    const persistEvent = vi.fn().mockResolvedValue(undefined);
    const handler = createWhatsAppWebhookHandler({
      getVerifyToken: () => verifyToken,
      getAppSecret: () => appSecret,
      persistEvent,
    });
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "1799725827819599",
        changes: [{
          field: "messages",
          value: {
            messages: [{ from: "not-a-phone", id: "bad", timestamp: "never", type: "text" }],
            statuses: [{ id: "bad", status: "invented", timestamp: "1789164000" }],
          },
        }],
      }],
    };

    const response = await handler(signedRequest(payload));

    expect(response.status).toBe(200);
    expect(persistEvent).toHaveBeenCalledWith(expect.objectContaining({ messages: [], statuses: [] }));
  });

  it("rejects a payload whose signature does not match the raw body", async () => {
    const persistEvent = vi.fn();
    const handler = createWhatsAppWebhookHandler({
      getVerifyToken: () => verifyToken,
      getAppSecret: () => appSecret,
      persistEvent,
    });
    const request = signedRequest(
      { object: "whatsapp_business_account", entry: [] },
      { headers: { "X-Hub-Signature-256": `sha256=${"0".repeat(64)}` } },
    );

    const response = await handler(request);

    expect(response.status).toBe(401);
    expect(persistEvent).not.toHaveBeenCalled();
  });

  it("rejects malformed and oversized request bodies before persistence", async () => {
    const persistEvent = vi.fn();
    const handler = createWhatsAppWebhookHandler({
      getVerifyToken: () => verifyToken,
      getAppSecret: () => appSecret,
      persistEvent,
      maxBodyBytes: 32,
    });

    const malformed = await handler(signedRequest("not an event"));
    const oversized = await handler(signedRequest({
      object: "whatsapp_business_account",
      entry: [{ id: "1799725827819599" }],
    }));

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(persistEvent).not.toHaveBeenCalled();
  });

  it("returns a retryable error when durable persistence fails", async () => {
    const handler = createWhatsAppWebhookHandler({
      getVerifyToken: () => verifyToken,
      getAppSecret: () => appSecret,
      persistEvent: vi.fn().mockRejectedValue(new Error("database unavailable")),
    });

    const response = await handler(signedRequest({
      object: "whatsapp_business_account",
      entry: [{ id: "1799725827819599", changes: [] }],
    }));

    expect(response.status).toBe(503);
  });
});
