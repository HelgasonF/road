import { describe, expect, it, vi } from "vitest";

import { ensureMessagesWebhookSubscription } from "./whatsapp-management";

const config = {
  accessToken: "permanent-system-user-token",
  appId: "1403947388469576",
  appSecret: "0123456789abcdef0123456789abcdef",
  callbackUrl: "https://example.supabase.co/functions/v1/whatsapp-webhook-v1",
  graphApiVersion: "v25.0",
  verifyToken: "webhook-verify-token",
  wabaId: "1799725827819599",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("WhatsApp webhook management", () => {
  it("subscribes the messages field and the app to the WABA", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ success: true }))
      .mockResolvedValueOnce(response({ success: true }));

    await expect(ensureMessagesWebhookSubscription(config, fetcher)).resolves.toEqual({
      appSubscribed: true,
      messagesFieldSubscribed: true,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const [appUrl, appInit] = fetcher.mock.calls[0];
    expect(appUrl).toBe("https://graph.facebook.com/v25.0/1403947388469576/subscriptions");
    expect(appInit.method).toBe("POST");
    expect(appInit.headers.Authorization).toBe(
      "Bearer 1403947388469576|0123456789abcdef0123456789abcdef",
    );
    expect(new URLSearchParams(appInit.body)).toEqual(new URLSearchParams({
      callback_url: config.callbackUrl,
      fields: "messages",
      include_values: "true",
      object: "whatsapp_business_account",
      verify_token: config.verifyToken,
    }));

    const [wabaUrl, wabaInit] = fetcher.mock.calls[1];
    expect(wabaUrl).toBe("https://graph.facebook.com/v25.0/1799725827819599/subscribed_apps");
    expect(wabaInit).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer permanent-system-user-token" },
    });
  });

  it("returns a sanitized error when Meta rejects a configuration request", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      error: { code: 190, message: "Invalid OAuth access token" },
    }, 401));

    await expect(ensureMessagesWebhookSubscription(config, fetcher)).rejects.toMatchObject({
      code: "meta_configuration_rejected",
      metaCode: 190,
      status: 401,
    });
  });
});
