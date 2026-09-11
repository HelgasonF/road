export type WhatsAppWebhookEvent = {
  payload: Record<string, unknown>;
  payloadSha256: string;
  wabaId: string | null;
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
        await persistEvent({
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
