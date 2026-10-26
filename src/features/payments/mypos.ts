import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { parseMyPosConfig, PaymentError, type MyPosConfig, type PaymentDiagnostics } from "./mypos-config";
import { paymentAmountSchema } from "./schemas";
import type { PaymentAccount, PaymentProvider, ProviderPaymentInput, VerifiedPaymentStatus } from "./types";

const HOSTS = {
  sandbox: { token: "https://sandbox-auth-api.mypos.com/oauth/token", api: "https://sandbox-transactions-api.mypos.com/v1.1" },
  production: { token: "https://auth-api.mypos.com/oauth/token", api: "https://transactions-api.mypos.com/v1.1" },
};
const paymentPath = "/online-payments/payment-request";
const codeSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const referenceSchema = z.string().min(1).max(120);
const createSchema = z.object({ code: codeSchema, payment_request_url: z.url().max(2048) });
const detailSchema = z.object({
  code: codeSchema, amount: paymentAmountSchema, currency: z.literal("ISK"),
  booking_text: referenceSchema, status: z.number().int().nonnegative().max(2_147_483_647),
  qr_generated: z.literal(false),
});
// The live legacy sandbox returns expires_in as a decimal string, unlike the
// Gateway. Accept that documented/tested shape and numeric lifetimes only.
const expirySchema = z.union([z.number(), z.string().regex(/^[1-9]\d*$/).transform(Number)])
  .pipe(z.number().int().positive().max(2_147_483_647));
const tokenSchema = z.object({ access_token: z.string().min(1).regex(/^[^\r\n]+$/), expires_in: expirySchema });
const optionsSchema = z.object({
  amountIsk: paymentAmountSchema,
  customerName: z.string().trim().min(1).max(160),
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  expiryDate: z.iso.date().optional(),
});
const settlementSchema = z.array(z.object({
  settlement_currency: z.string().regex(/^[A-Z]{3}$/),
  account: z.object({ account_number: z.string().min(1), is_reserve: z.boolean().optional() }).nullable(),
})).max(200);
const languagesSchema = z.array(z.object({ code: z.string().regex(/^[A-Za-z]{2}$/) })).min(1).max(200);
const statuses: Record<number, VerifiedPaymentStatus> = {
  1: "pending", 2: "seen", 3: "failed", 4: "paid", 5: "expired", 6: "cancelled",
};

type Token = { value: string; expiresAt: number };
export type MyPosAccountCapabilities = { currencies: string[]; languages: string[]; iskSupported: boolean };

function providerCustomerName(name: string) {
  // The legacy API rejects Icelandic letters even with UTF-8/escaped JSON.
  // Keep the actual name in the private draft/job; adapt only myPOS's display.
  const letters: Record<string, string> = { Þ: "Th", þ: "th", Ð: "D", ð: "d", Æ: "Ae", æ: "ae", Ø: "O", ø: "o", Ł: "L", ł: "l", ß: "ss", Œ: "Oe", œ: "oe" };
  return name.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[ÞþÐðÆæØøŁłßŒœ]/g, (letter) => letters[letter]);
}

/** Only this adapter knows legacy hosts, headers, response shapes and codes. */
export class MyPosProvider implements PaymentProvider {
  readonly account: PaymentAccount;
  private readonly config: MyPosConfig;
  private token?: Token;
  private authenticating?: Promise<Token>;
  private capabilities?: { value: MyPosAccountCapabilities; expiresAt: number };
  private inspecting?: Promise<MyPosAccountCapabilities>;

  constructor(config: MyPosConfig, private readonly fetcher: typeof fetch = fetch) {
    this.config = parseMyPosConfig(config);
    this.account = Object.freeze({ environment: this.config.environment, merchantId: this.config.clientId, providerApi: "rest_v1_1" });
  }

  private async request(url: string, init: RequestInit, creating = false): Promise<unknown> {
    try {
      const response = await this.fetcher(url, {
        ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const uncertain = creating && (response.status >= 500 || response.status === 408 || response.status === 429);
        const code = response.status >= 500 || response.status === 408 ? "payment_provider_unavailable"
          : response.status === 401 ? "payment_authentication_failed"
          : response.status === 403 ? "payment_permission_denied"
          : response.status === 429 ? "payment_rate_limited" : "payment_provider_rejected";
        const diagnostics: PaymentDiagnostics = { httpStatus: response.status };
        const requestId = z.uuid().safeParse(new Headers(init.headers).get("X-Request-ID"));
        if (requestId.success) diagnostics.requestId = requestId.data;
        // Only a short numeric provider code is safe to retain. Never persist
        // arbitrary messages/details that can echo customer data or secrets.
        try {
          const body = await response.json();
          const providerCode = z.union([z.number().int().nonnegative(), z.string().regex(/^\d{1,8}$/)])
            .transform(String).pipe(z.string().max(8)).safeParse(body?.code);
          if (providerCode.success) diagnostics.providerCode = providerCode.data;
        } catch { /* Non-JSON error responses still retain HTTP status/request ID. */ }
        throw new PaymentError(code, uncertain, diagnostics);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw new PaymentError("payment_provider_unavailable", creating);
    }
  }

  private async authenticate(): Promise<Token> {
    const startedAt = Date.now();
    // Colon-delimited HTTP Basic was verified with the vendor's public sandbox.
    // Never try alternate encodings or send Gateway/merchant-session headers.
    const parsed = tokenSchema.safeParse(await this.request(HOSTS[this.config.environment].token, {
      method: "POST",
      headers: {
        Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`, "utf8").toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    }));
    if (!parsed.success) throw new PaymentError("payment_invalid_auth_response");
    const lifetime = parsed.data.expires_in * 1000;
    return { value: parsed.data.access_token, expiresAt: startedAt + lifetime - Math.min(30_000, lifetime / 10) };
  }

  private async accessToken() {
    if (!this.token || this.token.expiresAt <= Date.now()) {
      this.authenticating ??= this.authenticate();
      try { this.token = await this.authenticating; }
      finally { this.authenticating = undefined; }
    }
    return this.token;
  }

  private headers(token: Token) {
    return { Accept: "application/json", Authorization: `Bearer ${token.value}`, "API-Key": this.config.clientId, "X-Request-ID": randomUUID() };
  }

  private async read(path: string) {
    const token = await this.accessToken();
    const url = `${HOSTS[this.config.environment].api}${path}`;
    try { return await this.request(url, { headers: this.headers(token) }); }
    catch (error) {
      if (!(error instanceof PaymentError) || error.code !== "payment_authentication_failed") throw error;
      // A stale concurrent 401 must not invalidate a token already refreshed by
      // another read. Exactly one refresh/retry is permitted, for GET only.
      if (this.token === token) this.token = undefined;
      return this.request(url, { headers: this.headers(await this.accessToken()) });
    }
  }

  private async fetchCapabilities(): Promise<MyPosAccountCapabilities> {
    const [settlementBody, languageBody] = await Promise.all([
      this.read("/online-payments/settlement-data"), this.read("/online-payments/languages"),
    ]);
    const settlement = settlementSchema.safeParse(settlementBody);
    const languages = languagesSchema.safeParse(languageBody);
    if (!settlement.success || !languages.success) throw new PaymentError("payment_invalid_response");
    const currencies = [...new Set(settlement.data.filter((row) => row.account && !row.account.is_reserve).map((row) => row.settlement_currency))].sort();
    return { currencies, languages: [...new Set(languages.data.map((row) => row.code.toLowerCase()))].sort(), iskSupported: currencies.includes("ISK") };
  }

  /** Read-only: no payment creation, PII, bank identifiers or secrets returned. */
  async inspectAccount(): Promise<MyPosAccountCapabilities> {
    if (!this.capabilities || this.capabilities.expiresAt <= Date.now()) {
      this.inspecting ??= this.fetchCapabilities();
      try { this.capabilities = { value: await this.inspecting, expiresAt: Date.now() + 60_000 }; }
      finally { this.inspecting = undefined; }
    }
    return { ...this.capabilities.value, currencies: [...this.capabilities.value.currencies], languages: [...this.capabilities.value.languages] };
  }

  async prepare(input: Omit<ProviderPaymentInput, "reference">) {
    if (this.config.environment === "production" && !this.config.livePaymentsEnabled) throw new PaymentError("live_payments_disabled");
    if (!input.customerName?.trim()) throw new PaymentError("payment_customer_name_required");
    const parsed = optionsSchema.safeParse(input);
    if (!parsed.success) throw new PaymentError("payment_invalid_input");
    const capabilities = await this.inspectAccount();
    if (!capabilities.iskSupported) throw new PaymentError("payment_isk_unavailable");
    if (parsed.data.language && !capabilities.languages.includes(parsed.data.language)) throw new PaymentError("payment_language_unsupported");
  }

  async create(input: ProviderPaymentInput) {
    if (!referenceSchema.safeParse(input.reference).success) throw new PaymentError("payment_invalid_input");
    await this.prepare(input);
    const value = optionsSchema.parse(input);
    const token = await this.accessToken();
    const response = createSchema.safeParse(await this.request(`${HOSTS[this.config.environment].api}${paymentPath}`, {
      method: "POST", headers: { ...this.headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: value.amountIsk, currency: "ISK", client_name: providerCustomerName(value.customerName),
        booking_text: input.reference, qr_generated: false,
        // The legacy API documents the empty value as the merchant/default
        // language. No caller language is replaced or guessed here.
        payment_request_lang: value.language ?? "",
        // This spelling and the returned expiry were verified in sandbox.
        ...(value.expiryDate ? { expiry_date: value.expiryDate } : {}),
      }),
    }, true));
    if (!response.success) throw new PaymentError("payment_invalid_response", true);
    const url = new URL(response.data.payment_request_url);
    const allowedHosts = this.config.environment === "sandbox"
      ? ["demo.mypos.eu", "demo.mypos.com"] : ["mypos.eu", "www.mypos.eu", "mypos.com", "www.mypos.com"];
    if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname) || url.username || url.password || url.port || url.hash) {
      throw new PaymentError("payment_invalid_response", true);
    }
    return { code: response.data.code, url: response.data.payment_request_url };
  }

  async get(code: string) {
    if (!codeSchema.safeParse(code).success) throw new PaymentError("payment_invalid_input");
    const parsed = detailSchema.safeParse(await this.read(`${paymentPath}/${encodeURIComponent(code)}`));
    if (!parsed.success || parsed.data.code !== code) throw new PaymentError("payment_invalid_response");
    const value = parsed.data;
    return { code, amountIsk: value.amount, currency: value.currency, reference: value.booking_text, status: statuses[value.status] ?? "unknown", providerStatus: String(value.status) };
  }
}
