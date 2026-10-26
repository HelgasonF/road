import "server-only";

import { z } from "zod";
import { paymentAmountSchema } from "./schemas";

const nonempty = z.string().trim().min(1).max(500).regex(/^[^\r\n]+$/);
const configSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  clientId: nonempty.regex(/^[^:\s]+$/),
  // Preserve the actual secret; do not silently trim credential characters.
  clientSecret: z.string().min(1).max(500).regex(/^[^\r\n]+$/),
  livePaymentsEnabled: z.boolean().default(false),
});

export type MyPosConfig = z.infer<typeof configSchema>;

export type PaymentDiagnostics = { httpStatus?: number; providerCode?: string; requestId?: string };

export class PaymentError extends Error {
  constructor(public readonly code: string, public readonly uncertain = false, public readonly diagnostics: PaymentDiagnostics = {}) {
    // Never attach provider bodies, URLs, credentials, or fetch exceptions.
    super(code);
    this.name = "PaymentError";
  }
}

export function getMyPosConfig(): MyPosConfig {
  if (process.env.MYPOS_LEGACY_ENABLED !== "true") throw new PaymentError("payments_disabled");
  return parseMyPosConfig({
    environment: process.env.MYPOS_REST_ENV ?? "sandbox",
    clientId: process.env.MYPOS_REST_CLIENT_ID,
    clientSecret: process.env.MYPOS_REST_CLIENT_SECRET,
    livePaymentsEnabled: process.env.MYPOS_LIVE_PAYMENTS_ENABLED === "true",
  });
}

/** Also used by the opt-in read-only account check; never reports raw input. */
export function parseMyPosConfig(value: unknown): MyPosConfig {
  const parsed = configSchema.safeParse(value);
  if (!parsed.success) throw new PaymentError("payment_configuration_error");
  return parsed.data;
}

export function getInitialFeeIsk() {
  const value = process.env.MYPOS_INITIAL_FEE_ISK?.trim();
  if (!value || !/^[1-9]\d*$/.test(value)) throw new PaymentError("initial_fee_not_configured");
  const parsed = paymentAmountSchema.safeParse(Number(value));
  if (!parsed.success) throw new PaymentError("initial_fee_not_configured");
  return parsed.data;
}
