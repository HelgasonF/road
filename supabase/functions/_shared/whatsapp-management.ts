export type WhatsAppManagementConfig = {
  accessToken: string;
  appId: string;
  appSecret: string;
  callbackUrl: string;
  graphApiVersion: string;
  verifyToken: string;
  wabaId: string;
};

export type WhatsAppAccountInspectionConfig = Pick<
  WhatsAppManagementConfig,
  "accessToken" | "graphApiVersion" | "wabaId"
>;

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export class MetaConfigurationError extends Error {
  readonly code = "meta_configuration_rejected";

  constructor(
    readonly status: number,
    readonly metaCode: number | null,
  ) {
    super("Meta rejected the WhatsApp configuration request");
    this.name = "MetaConfigurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readMetaResult(response: Response) {
  const value: unknown = await response.json().catch(() => null);
  const success = isRecord(value) && value.success === true;

  if (response.ok && success) return;

  const error = isRecord(value) && isRecord(value.error) ? value.error : null;
  const metaCode = error && typeof error.code === "number" ? error.code : null;
  throw new MetaConfigurationError(response.status, metaCode);
}

async function readMetaJson(response: Response) {
  const value: unknown = await response.json().catch(() => null);

  if (response.ok && isRecord(value)) return value;

  const error = isRecord(value) && isRecord(value.error) ? value.error : null;
  const metaCode = error && typeof error.code === "number" ? error.code : null;
  throw new MetaConfigurationError(response.status, metaCode);
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function sanitizePhoneNumber(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const result: Record<string, string | boolean> = { id: value.id };
  const stringFields = {
    code_verification_status: "codeVerificationStatus",
    display_phone_number: "displayPhoneNumber",
    platform_type: "platformType",
    quality_rating: "qualityRating",
    status: "status",
    verified_name: "verifiedName",
  } as const;

  for (const [source, target] of Object.entries(stringFields)) {
    const field = optionalString(value, source);
    if (field !== undefined) result[target] = field;
  }

  if (typeof value.is_on_biz_app === "boolean") {
    result.isOnBizApp = value.is_on_biz_app;
  }

  return result;
}

function subscriptionAppId(value: unknown) {
  if (!isRecord(value)) return null;
  if (typeof value.id === "string") return value.id;

  const app = value.whatsapp_business_api_data;
  return isRecord(app) && typeof app.id === "string" ? app.id : null;
}

export async function inspectWhatsAppBusinessAccount(
  config: WhatsAppAccountInspectionConfig,
  fetcher: FetchLike = fetch,
) {
  const fields = [
    "id",
    "display_phone_number",
    "verified_name",
    "quality_rating",
    "code_verification_status",
    "platform_type",
    "is_on_biz_app",
    "status",
  ].join(",");
  const headers = { Authorization: `Bearer ${config.accessToken}` };

  const phoneNumbersResponse = await fetcher(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.wabaId}/phone_numbers?fields=${fields}`,
    { method: "GET", headers },
  );
  const phoneNumbersResult = await readMetaJson(phoneNumbersResponse);

  const subscriptionsResponse = await fetcher(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.wabaId}/subscribed_apps`,
    { method: "GET", headers },
  );
  const subscriptionsResult = await readMetaJson(subscriptionsResponse);

  const phoneNumbers = Array.isArray(phoneNumbersResult.data)
    ? phoneNumbersResult.data.map(sanitizePhoneNumber).filter((value) => value !== null)
    : [];
  const subscribedAppIds = Array.isArray(subscriptionsResult.data)
    ? [...new Set(
      subscriptionsResult.data.map(subscriptionAppId).filter((value) => value !== null),
    )]
    : [];

  return {
    phoneNumbers,
    subscribedAppIds,
    wabaId: config.wabaId,
  };
}

export async function ensureMessagesWebhookSubscription(
  config: WhatsAppManagementConfig,
  fetcher: FetchLike = fetch,
) {
  const appSubscription = await fetcher(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.appId}/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.appId}|${config.appSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        callback_url: config.callbackUrl,
        fields: "messages",
        include_values: "true",
        object: "whatsapp_business_account",
        verify_token: config.verifyToken,
      }),
    },
  );
  await readMetaResult(appSubscription);

  const wabaSubscription = await fetcher(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.wabaId}/subscribed_apps`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}` },
    },
  );
  await readMetaResult(wabaSubscription);

  return {
    appSubscribed: true,
    messagesFieldSubscribed: true,
  };
}
