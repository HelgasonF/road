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

export type WhatsAppTemplateManagementConfig = Pick<
  WhatsAppManagementConfig,
  "accessToken" | "graphApiVersion" | "wabaId"
>;

type WhatsAppTemplateDefinition = {
  category: "UTILITY";
  components: Array<Record<string, unknown>>;
  language: "en_US";
  name: string;
};

export const operationalWhatsAppTemplates: WhatsAppTemplateDefinition[] = [
  {
    name: "vegstod_customer_intake_v1",
    language: "en_US",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Vegstod has created a secure link for your roadside assistance request. Add your name, location, vehicle details, the assistance needed, a short description, and optional photos. The private link expires in 24 hours. Do not forward it.",
      },
      {
        type: "FOOTER",
        text: "Vegstod road assistance",
      },
      {
        type: "BUTTONS",
        buttons: [{
          type: "URL",
          text: "Open secure request",
          url: "https://vegstod.vercel.app/customer/{{1}}",
          example: ["example-token"],
        }],
      },
    ],
  },
  {
    name: "vegstod_driver_availability_v1",
    language: "en_US",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}. Are you available for a Vegstod roadside assistance job?\nArea: {{2}}\nAssistance: {{3}}\nPriority: {{4}}\nApprox. straight-line distance: {{5}}\nReply Available or Unavailable.",
        example: {
          body_text: [["Jon", "Akureyri", "Towing", "Normal", "12 km"]],
        },
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Available" },
          { type: "QUICK_REPLY", text: "Unavailable" },
        ],
      },
    ],
  },
  {
    name: "vegstod_driver_assignment_v1",
    language: "en_US",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}. A Vegstod roadside assistance job has been assigned to you.\nArea: {{2}}\nAssistance: {{3}}\nPriority: {{4}}\nOpen the secure link for the exact location and customer details. The link expires; do not forward it.",
        example: {
          body_text: [["Jon", "Akureyri", "Towing", "Normal"]],
        },
      },
      {
        type: "BUTTONS",
        buttons: [{
          type: "URL",
          text: "Open assigned job",
          url: "https://vegstod.vercel.app/driver/access?code={{1}}",
          example: ["magiclink.example-token"],
        }],
      },
    ],
  },
];

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

function sanitizeTemplate(value: unknown, created: boolean) {
  if (!isRecord(value)) return null;
  const id = optionalString(value, "id");
  const name = optionalString(value, "name");
  const language = optionalString(value, "language");
  const status = optionalString(value, "status");
  const category = optionalString(value, "category");
  if (!id || !name || !language || !status) return null;

  return {
    id,
    name,
    language,
    status,
    ...(category ? { category } : {}),
    created,
  };
}

export async function ensureOperationalMessageTemplates(
  config: WhatsAppTemplateManagementConfig,
  fetcher: FetchLike = fetch,
) {
  const headers = { Authorization: `Bearer ${config.accessToken}` };
  const templates = [];

  for (const definition of operationalWhatsAppTemplates) {
    const query = new URLSearchParams({
      fields: "id,name,status,category,language",
      limit: "100",
      name: definition.name,
    });
    const listResponse = await fetcher(
      `https://graph.facebook.com/${config.graphApiVersion}/${config.wabaId}/message_templates?${query}`,
      { method: "GET", headers },
    );
    const listResult = await readMetaJson(listResponse);
    const existing = Array.isArray(listResult.data)
      ? listResult.data
        .map((value) => sanitizeTemplate(value, false))
        .find((value) => value?.name === definition.name && value.language === definition.language)
      : null;

    if (existing) {
      templates.push(existing);
      continue;
    }

    const createResponse = await fetcher(
      `https://graph.facebook.com/${config.graphApiVersion}/${config.wabaId}/message_templates`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(definition),
      },
    );
    const createResult = await readMetaJson(createResponse);
    const created = sanitizeTemplate({
      ...createResult,
      language: definition.language,
      name: definition.name,
    }, true);
    if (!created) throw new MetaConfigurationError(createResponse.status, null);
    templates.push(created);
  }

  return { templates };
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
