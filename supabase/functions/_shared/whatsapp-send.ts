export type WhatsAppMessagePurpose =
  | "customer_intake"
  | "driver_availability"
  | "driver_assignment"
  | "test";

export type WhatsAppTemplateInput = {
  bodyParameters: string[];
  buttonUrlSuffix: string | null;
  customerIntakeLinkId: string | null;
  idempotencyKey: string;
  jobId: string | null;
  operatorId: string | null;
  purpose: WhatsAppMessagePurpose;
  recipientPhone: string;
};

export type WhatsAppTemplateConfig = {
  accessToken: string;
  graphApiVersion: string;
  language: string;
  phoneNumberId: string;
  templateName: string;
};

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class WhatsAppSendInputError extends Error {
  readonly code = "invalid_request";

  constructor() {
    super("Invalid WhatsApp send request");
    this.name = "WhatsAppSendInputError";
  }
}

export class WhatsAppProviderError extends Error {
  readonly code = "whatsapp_provider_rejected";

  constructor(
    readonly status: number,
    readonly metaCode: string | null,
    readonly deliveryUnknown: boolean,
  ) {
    super("WhatsApp provider rejected the message");
    this.name = "WhatsAppProviderError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function optionalUuid(value: unknown) {
  if (value === undefined || value === null) return null;
  if (!isUuid(value)) throw new WhatsAppSendInputError();
  return value;
}

function normalizeRecipientPhone(value: unknown) {
  if (typeof value !== "string") throw new WhatsAppSendInputError();
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  const normalized = trimmed.startsWith("+")
    ? digits
    : digits.startsWith("00")
      ? digits.slice(2)
      : digits.length === 7
        ? `354${digits}`
        : digits;

  if (!/^[1-9][0-9]{6,14}$/.test(normalized)) throw new WhatsAppSendInputError();
  return normalized;
}

function messageParameters(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) throw new WhatsAppSendInputError();
  return value.map((parameter) => {
    if (typeof parameter !== "string" || parameter.length < 1 || parameter.length > 1_024) {
      throw new WhatsAppSendInputError();
    }
    return parameter;
  });
}

function optionalButtonSuffix(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length < 1 || value.length > 2_000) {
    throw new WhatsAppSendInputError();
  }
  return value;
}

export function parseWhatsAppTemplateInput(value: unknown): WhatsAppTemplateInput {
  if (!isRecord(value) || value.action !== "send_template" || !isUuid(value.idempotencyKey)) {
    throw new WhatsAppSendInputError();
  }

  const purpose = value.purpose;
  if (![
    "customer_intake",
    "driver_availability",
    "driver_assignment",
    "test",
  ].includes(String(purpose))) throw new WhatsAppSendInputError();

  const input: WhatsAppTemplateInput = {
    bodyParameters: messageParameters(value.bodyParameters),
    buttonUrlSuffix: optionalButtonSuffix(value.buttonUrlSuffix),
    customerIntakeLinkId: optionalUuid(value.customerIntakeLinkId),
    idempotencyKey: value.idempotencyKey,
    jobId: optionalUuid(value.jobId),
    operatorId: optionalUuid(value.operatorId),
    purpose: purpose as WhatsAppMessagePurpose,
    recipientPhone: normalizeRecipientPhone(value.recipientPhone),
  };

  const validReferenceShape = input.purpose === "test"
    ? !input.jobId && !input.operatorId && !input.customerIntakeLinkId
    : input.purpose === "customer_intake"
      ? Boolean(input.jobId && !input.operatorId && input.customerIntakeLinkId)
      : Boolean(input.jobId && input.operatorId && !input.customerIntakeLinkId);
  if (!validReferenceShape) throw new WhatsAppSendInputError();

  if (input.purpose === "test" && (input.bodyParameters.length > 0 || input.buttonUrlSuffix)) {
    throw new WhatsAppSendInputError();
  }

  return input;
}

export function buildWhatsAppTemplatePayload(
  input: WhatsAppTemplateInput,
  config: Pick<WhatsAppTemplateConfig, "language" | "templateName">,
) {
  const components: Array<Record<string, unknown>> = [];
  if (input.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.map((parameter) => ({ type: "text", text: parameter })),
    });
  }
  if (input.buttonUrlSuffix) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: input.buttonUrlSuffix }],
    });
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.recipientPhone,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: config.language },
      ...(components.length > 0 ? { components } : {}),
    },
  };
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function payloadSha256(payload: Record<string, unknown>) {
  return bytesToHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))),
  );
}

function providerErrorCode(value: unknown) {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  const code = value.error.code;
  if (typeof code === "number" && Number.isSafeInteger(code)) return String(code);
  if (typeof code === "string" && code.length <= 120) return code;
  return null;
}

export async function sendWhatsAppTemplate(
  config: WhatsAppTemplateConfig,
  payload: Record<string, unknown>,
  fetcher: FetchLike = fetch,
) {
  let response: Response;
  try {
    response = await fetcher(
      `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
  } catch {
    throw new WhatsAppProviderError(0, null, true);
  }

  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new WhatsAppProviderError(
      response.status,
      providerErrorCode(result),
      response.status >= 500,
    );
  }

  const messages = isRecord(result) ? result.messages : null;
  const messageId = Array.isArray(messages) && isRecord(messages[0])
    ? messages[0].id
    : null;
  if (typeof messageId !== "string" || messageId.length < 1 || messageId.length > 255) {
    throw new WhatsAppProviderError(response.status, null, true);
  }

  return { messageId };
}
