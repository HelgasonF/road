export type WhatsAppManagementConfig = {
  accessToken: string;
  appId: string;
  appSecret: string;
  callbackUrl: string;
  graphApiVersion: string;
  verifyToken: string;
  wabaId: string;
};

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
