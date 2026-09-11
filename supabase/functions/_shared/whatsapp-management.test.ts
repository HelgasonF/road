import { describe, expect, it, vi } from "vitest";

import {
  ensureMessagesWebhookSubscription,
  inspectWhatsAppBusinessAccount,
} from "./whatsapp-management";

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

  it("reads and sanitizes a production WABA without changing it", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        data: [{
          code_verification_status: "VERIFIED",
          display_phone_number: "+354 853 7704",
          id: "987654321012345",
          is_on_biz_app: true,
          platform_type: "CLOUD_API",
          quality_rating: "GREEN",
          status: "CONNECTED",
          verified_name: "Iceland road assistance",
        }],
      }))
      .mockResolvedValueOnce(response({
        data: [{
          whatsapp_business_api_data: {
            id: config.appId,
            link: "https://example.invalid/app",
            name: "Iceland road assistance",
          },
        }],
      }));

    await expect(inspectWhatsAppBusinessAccount({
      accessToken: config.accessToken,
      graphApiVersion: config.graphApiVersion,
      wabaId: "931911699982634",
    }, fetcher)).resolves.toEqual({
      phoneNumbers: [{
        codeVerificationStatus: "VERIFIED",
        displayPhoneNumber: "+354 853 7704",
        id: "987654321012345",
        isOnBizApp: true,
        platformType: "CLOUD_API",
        qualityRating: "GREEN",
        status: "CONNECTED",
        verifiedName: "Iceland road assistance",
      }],
      subscribedAppIds: [config.appId],
      wabaId: "931911699982634",
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toContain(
      "/v25.0/931911699982634/phone_numbers?fields=",
    );
    expect(fetcher.mock.calls[1][0]).toBe(
      "https://graph.facebook.com/v25.0/931911699982634/subscribed_apps",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer permanent-system-user-token" },
      method: "GET",
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
