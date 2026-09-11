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
      payload,
      payloadSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      wabaId: "1799725827819599",
    });
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
