export type WhatsAppWebhookEvent = {
  messages: WhatsAppInboundMessage[];
  payload: Record<string, unknown>;
  payloadSha256: string;
  statuses: WhatsAppDeliveryEvent[];
  wabaId: string | null;
};

export type WhatsAppDeliveryEvent = {
  errorCode: string | null;
  messageId: string;
  occurredAt: string;
  recipientPhone: string | null;
  status: "sent" | "delivered" | "read" | "failed";
};

export type WhatsAppInboundMessage = {
  contextMessageId: string | null;
  messageId: string;
  messageType: string;
  occurredAt: string;
  phoneNumberId: string | null;
  replyClassification: "available" | "unavailable" | "unknown";
  senderPhone: string;
  textBody: string | null;
};

type WhatsAppWebhookHandlerOptions = {
  getVerifyToken: () => string | undefined;
  getAppSecret: () => string | undefined;
  persistEvent: (event: WhatsAppWebhookEvent) => Promise<void>;
  maxBodyBytes?: number;
};

const DEFAULT_MAX_BODY_BYTES = 1_048_576;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function constantTimeEquals(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signBody(body: ArrayBuffer, appSecret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, body));
}

async function bodySha256(body: ArrayBuffer) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", body));
}

function getWabaId(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.entry)) return null;
  const firstEntry = payload.entry[0];
  return isRecord(firstEntry) && typeof firstEntry.id === "string" ? firstEntry.id : null;
}

function limitedString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, maxLength)
    : null;
}

function numericString(value: unknown, maxLength = 32) {
  const textValue = limitedString(value, maxLength);
  return textValue && /^[0-9]+$/.test(textValue) ? textValue : null;
}

function metaTimestamp(value: unknown) {
  const timestamp = typeof value === "string" && /^[0-9]{1,12}$/.test(value)
    ? Number(value)
    : Number.NaN;
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) return null;

  const date = new Date(timestamp * 1_000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function firstErrorCode(value: unknown) {
  if (!Array.isArray(value) || !isRecord(value[0])) return null;
  const code = value[0].code;
  if (typeof code === "number" && Number.isSafeInteger(code)) return String(code);
  return limitedString(code, 120);
}

function inboundText(message: Record<string, unknown>) {
  if (isRecord(message.text)) return limitedString(message.text.body, 4_096);
  if (isRecord(message.button)) return limitedString(message.button.text, 4_096);
  if (!isRecord(message.interactive)) return null;

  const buttonReply = message.interactive.button_reply;
  if (isRecord(buttonReply)) {
    return limitedString(buttonReply.title, 4_096) ?? limitedString(buttonReply.id, 4_096);
  }

  const listReply = message.interactive.list_reply;
  if (isRecord(listReply)) {
    return limitedString(listReply.title, 4_096) ?? limitedString(listReply.id, 4_096);
  }

  return null;
}

function normalizeReply(value: string | null) {
  if (!value) return "unknown" as const;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("is")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");

  if ([
    "ekki laus",
    "nei",
    "no",
    "not available",
    "unavailable",
    "driver_unavailable",
  ].includes(normalized)) return "unavailable" as const;

  if ([
    "laus",
    "ja",
    "yes",
    "available",
    "driver_available",
  ].includes(normalized)) return "available" as const;

  return "unknown" as const;
}

function extractWebhookData(payload: Record<string, unknown>) {
  const statuses: WhatsAppDeliveryEvent[] = [];
  const messages: WhatsAppInboundMessage[] = [];

  if (!Array.isArray(payload.entry)) return { messages, statuses };

  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue;
      const phoneNumberId = isRecord(change.value.metadata)
        ? numericString(change.value.metadata.phone_number_id)
        : null;

      if (Array.isArray(change.value.statuses)) {
        for (const statusValue of change.value.statuses) {
          if (!isRecord(statusValue)) continue;
          const messageId = limitedString(statusValue.id, 255);
          const occurredAt = metaTimestamp(statusValue.timestamp);
          const status = statusValue.status;
          if (
            !messageId
            || !occurredAt
            || !["sent", "delivered", "read", "failed"].includes(String(status))
          ) continue;

          statuses.push({
            errorCode: firstErrorCode(statusValue.errors),
            messageId,
            occurredAt,
            recipientPhone: numericString(statusValue.recipient_id, 15),
            status: status as WhatsAppDeliveryEvent["status"],
          });
        }
      }

      if (Array.isArray(change.value.messages)) {
        for (const messageValue of change.value.messages) {
          if (!isRecord(messageValue)) continue;
          const messageId = limitedString(messageValue.id, 255);
          const occurredAt = metaTimestamp(messageValue.timestamp);
          const senderPhone = numericString(messageValue.from, 15);
          const rawType = limitedString(messageValue.type, 40);
          if (!messageId || !occurredAt || !senderPhone || !rawType) continue;

          const messageType = /^[a-z_]+$/.test(rawType) ? rawType : "unknown";
          const textBody = inboundText(messageValue);
          const contextMessageId = isRecord(messageValue.context)
            ? limitedString(messageValue.context.id, 255)
            : null;

          messages.push({
            contextMessageId,
            messageId,
            messageType,
            occurredAt,
            phoneNumberId,
            replyClassification: normalizeReply(textBody),
            senderPhone,
            textBody,
          });
        }
      }
    }
  }

  return { messages, statuses };
}

function isWhatsAppPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && value.object === "whatsapp_business_account"
    && Array.isArray(value.entry);
}

export function createWhatsAppWebhookHandler({
  getVerifyToken,
  getAppSecret,
  persistEvent,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
}: WhatsAppWebhookHandlerOptions) {
  return async function handleWhatsAppWebhook(request: Request) {
    if (request.method === "GET") {
      const expectedToken = getVerifyToken();
      if (!expectedToken) return json({ error: { code: "configuration_unavailable" } }, 503);

      const parameters = new URL(request.url).searchParams;
      const mode = parameters.get("hub.mode");
      const suppliedToken = parameters.get("hub.verify_token");
      const challenge = parameters.get("hub.challenge");

      if (
        mode !== "subscribe"
        || suppliedToken === null
        || challenge === null
        || !constantTimeEquals(suppliedToken, expectedToken)
      ) {
        return json({ error: { code: "verification_failed" } }, 403);
      }

      return text(challenge, 200);
    }

    if (request.method === "POST") {
      const appSecret = getAppSecret();
      if (!appSecret) return json({ error: { code: "configuration_unavailable" } }, 503);

      const declaredLength = Number(request.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
        return json({ error: { code: "payload_too_large" } }, 413);
      }

      const body = await request.arrayBuffer();
      if (body.byteLength > maxBodyBytes) {
        return json({ error: { code: "payload_too_large" } }, 413);
      }

      const suppliedSignature = request.headers.get("x-hub-signature-256");
      const expectedSignature = await signBody(body, appSecret);
      if (
        suppliedSignature === null
        || !/^sha256=[0-9a-f]{64}$/i.test(suppliedSignature)
        || !constantTimeEquals(suppliedSignature.slice(7).toLowerCase(), expectedSignature)
      ) {
        return json({ error: { code: "invalid_signature" } }, 401);
      }

      let payload: unknown;
      try {
        payload = JSON.parse(decoder.decode(body));
      } catch {
        return json({ error: { code: "invalid_payload" } }, 400);
      }

      if (!isWhatsAppPayload(payload)) {
        return json({ error: { code: "invalid_payload" } }, 400);
      }

      try {
        const extracted = extractWebhookData(payload);
        await persistEvent({
          ...extracted,
          payload,
          payloadSha256: await bodySha256(body),
          wabaId: getWabaId(payload),
        });
      } catch {
        return json({ error: { code: "persistence_unavailable" } }, 503);
      }

      return json({ received: true }, 200);
    }

    return new Response(null, {
      status: 405,
      headers: { Allow: "GET, POST", "Cache-Control": "no-store" },
    });
  };
}
