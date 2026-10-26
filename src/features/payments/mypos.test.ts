import { afterEach, describe, expect, it, vi } from "vitest";
import { MyPosProvider } from "./mypos";
import { getInitialFeeIsk, getMyPosConfig, type MyPosConfig } from "./mypos-config";
import { createPaymentSchema } from "./schemas";

vi.mock("server-only", () => ({}));

const config: MyPosConfig = {
  environment: "sandbox", clientId: "merchant_client", clientSecret: "merchant_secret", livePaymentsEnabled: false,
};
const input = { amountIsk: 5000, reference: "IRA-job-initial", customerName: "Existing Customer" };
const receipt = { code: "B123", payment_request_url: "https://demo.mypos.eu/pr/B123?ref=1" };
const details = { code: "B123", amount: 5000, currency: "ISK", booking_text: input.reference, status: 4, qr_generated: false };
const settlements = [{ settlement_currency: "ISK", account: { account_number: "test-account", is_reserve: false } }];
const languages = [{ code: "IS" }, { code: "EN" }, { code: "DE" }];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setup(options: { account?: unknown; locales?: unknown; config?: MyPosConfig } = {}) {
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    const path = String(url);
    if (path.endsWith("/oauth/token")) return json({ access_token: "bearer", expires_in: "86400", token_type: "Bearer" });
    if (path.endsWith("/settlement-data")) return json(options.account ?? settlements);
    if (path.endsWith("/languages")) return json(options.locales ?? languages);
    if (path.endsWith("/payment-request")) return json(receipt);
    if (path.endsWith("/payment-request/B123")) return json(details);
    throw new Error("Unexpected provider URL");
  });
  return { fetcher, provider: new MyPosProvider(options.config ?? config, fetcher) };
}
const creates = (fetcher: ReturnType<typeof setup>["fetcher"]) => fetcher.mock.calls.filter(([url]) => String(url).endsWith("/payment-request"));

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("legacy myPOS REST v1.1 contract", () => {
  it("uses merchant Basic OAuth and legacy UUID headers, with no Gateway session or partner credentials", async () => {
    const { provider, fetcher } = setup();
    await expect(provider.create(input)).resolves.toEqual({ code: "B123", url: receipt.payment_request_url });
    const [tokenUrl, token] = fetcher.mock.calls[0];
    expect(tokenUrl).toBe("https://sandbox-auth-api.mypos.com/oauth/token");
    expect(token?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("merchant_client:merchant_secret").toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" });
    expect(token?.body).toBe("grant_type=client_credentials");
    const [url, request] = creates(fetcher)[0];
    expect(url).toBe("https://sandbox-transactions-api.mypos.com/v1.1/online-payments/payment-request");
    expect(request?.headers).toMatchObject({ Authorization: "Bearer bearer", "API-Key": "merchant_client", "X-Request-ID": expect.stringMatching(uuid), "Content-Type": "application/json" });
    expect(request).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(JSON.parse(request?.body as string)).toEqual({ amount: 5000, currency: "ISK", booking_text: input.reference, qr_generated: false, client_name: input.customerName, payment_request_lang: "" });
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("gateway"))).toBe(true);
    for (const [, call] of fetcher.mock.calls) {
      expect(call?.headers).not.toHaveProperty("X-Session");
      expect(call?.headers).not.toHaveProperty("X-Partner-Id");
      expect(call?.headers).not.toHaveProperty("X-Application-Id");
    }
  });

  it("uses only the supplied supported locale and sandbox-verified expiry field", async () => {
    const { provider, fetcher } = setup();
    await provider.create({ ...input, language: "de", expiryDate: "2026-12-01" });
    expect(JSON.parse(creates(fetcher)[0][1]?.body as string)).toEqual({ amount: 5000, currency: "ISK", booking_text: input.reference, qr_generated: false, client_name: input.customerName, payment_request_lang: "de", expiry_date: "2026-12-01" });
  });

  it.each(["en", "is"])("collects for an Icelandic name in %s without changing the original name", async (language) => {
    const { provider, fetcher } = setup();
    const original = { ...input, customerName: "Þórður Ægir Guðjónsson", language };
    await provider.prepare(original);
    // The live legacy API rejects accented names with HTTP 400/code 4.
    fetcher.mockImplementationOnce(async (_url, request) => {
      const body = JSON.parse(String(request?.body));
      return /[^\x20-\x7e]/.test(body.client_name)
        ? json({ code: 4, message: "Execution failed", details: null }, 400)
        : json(receipt);
    });
    await expect(provider.create(original)).resolves.toMatchObject({ code: "B123" });
    expect(JSON.parse(creates(fetcher)[0][1]?.body as string)).toMatchObject({
      client_name: "Thordur Aegir Gudjonsson", payment_request_lang: language,
    });
    expect(original.customerName).toBe("Þórður Ægir Guðjónsson");
  });

  it("retains safe rejection diagnostics without retaining the provider message or details", async () => {
    const { provider, fetcher } = setup();
    await provider.prepare(input);
    fetcher.mockResolvedValueOnce(json({ code: 4, message: "private customer merchant_secret", details: "bearer" }, 400));
    const error = await provider.create(input).catch((error) => error);
    expect(error).toMatchObject({ code: "payment_provider_rejected", uncertain: false,
      diagnostics: { httpStatus: 400, providerCode: "4", requestId: expect.stringMatching(uuid) } });
    expect(JSON.stringify(error)).not.toMatch(/merchant_secret|private customer|bearer/);
  });

  it.each([undefined, "", "   "])("requires an existing customer name before authenticating (%s)", async (customerName) => {
    const { provider, fetcher } = setup();
    await expect(provider.create({ ...input, customerName })).rejects.toMatchObject({ code: "payment_customer_name_required" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [],
    [{ settlement_currency: "EUR", account: { account_number: "account" } }],
    [{ settlement_currency: "ISK", account: null }],
    [{ settlement_currency: "ISK", account: { account_number: "reserve", is_reserve: true } }],
  ].map((account) => ({ account })))("refuses creation without an eligible ISK settlement account", async ({ account }) => {
    const { provider, fetcher } = setup({ account });
    await expect(provider.create(input)).rejects.toMatchObject({ code: "payment_isk_unavailable" });
    expect(creates(fetcher)).toHaveLength(0);
  });

  it("refuses unsupported caller languages instead of imposing a fallback", async () => {
    const { provider, fetcher } = setup();
    await expect(provider.create({ ...input, language: "zh" })).rejects.toMatchObject({ code: "payment_language_unsupported" });
    expect(creates(fetcher)).toHaveLength(0);
  });

  it.each([{ account: {} }, { account: [{ currency: "ISK", account: {} }] }, { locales: { languages } }])("fails closed on malformed capability responses", async (options) => {
    const { provider, fetcher } = setup(options);
    await expect(provider.create(input)).rejects.toMatchObject({ code: "payment_invalid_response" });
    expect(creates(fetcher)).toHaveLength(0);
  });

  it("shares concurrent OAuth/capability reads and generates fresh UUIDs for each API request", async () => {
    const { provider, fetcher } = setup();
    await Promise.all([provider.prepare(input), provider.prepare(input)]);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/oauth/token"))).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/settlement-data"))).toHaveLength(1);
    await provider.get("B123");
    await provider.get("B123");
    const ids = fetcher.mock.calls.filter(([url]) => !String(url).endsWith("/oauth/token")).map(([, request]) => (request?.headers as Record<string, string>)["X-Request-ID"]);
    expect(ids.every((id) => uuid.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([408, 429, 500, 502])("never retries an uncertain payment creation (%s)", async (status) => {
    const { provider, fetcher } = setup();
    await provider.prepare(input);
    fetcher.mockResolvedValueOnce(json({ secret: "must-not-leak" }, status));
    await expect(provider.create(input)).rejects.toMatchObject({ uncertain: true });
    expect(creates(fetcher)).toHaveLength(1);
  });

  it.each([400, 401, 403])("does not refresh and repeat a rejected creation (%s)", async (status) => {
    const { provider, fetcher } = setup();
    await provider.prepare(input);
    fetcher.mockResolvedValueOnce(json({ secret: "must-not-leak" }, status));
    await expect(provider.create(input)).rejects.toMatchObject({ uncertain: false });
    expect(creates(fetcher)).toHaveLength(1);
  });

  it("does not retry timeouts or leak raw provider exceptions", async () => {
    const { provider, fetcher } = setup();
    await provider.prepare(input);
    fetcher.mockRejectedValueOnce(new Error("merchant_secret bearer private provider message"));
    await expect(provider.create(input)).rejects.toMatchObject({ code: "payment_provider_unavailable", message: "payment_provider_unavailable", uncertain: true });
    expect(creates(fetcher)).toHaveLength(1);
  });

  it.each([
    { code: null, payment_request_url: receipt.payment_request_url },
    { ...receipt, payment_request_url: "https://attacker.example/pr/B123" },
    { ...receipt, payment_request_url: "https://mypos.eu/pr/B123" },
    { ...receipt, payment_request_url: "http://demo.mypos.eu/pr/B123" },
    { ...receipt, payment_request_url: "https://demo.mypos.eu:444/pr/B123" },
    { ...receipt, payment_request_url: "https://user:password@demo.mypos.eu/pr/B123" },
  ])("refuses unsafe or cross-environment hosted URLs", async (response) => {
    const { provider, fetcher } = setup();
    await provider.prepare(input);
    fetcher.mockResolvedValueOnce(json(response));
    await expect(provider.create(input)).rejects.toMatchObject({ code: "payment_invalid_response", uncertain: true });
  });

  it.each([[1, "pending"], [2, "seen"], [3, "failed"], [4, "paid"], [5, "expired"], [6, "cancelled"], [99, "unknown"]] as const)("maps numeric status %s to %s and retains the raw value", async (status, normalized) => {
    const { provider, fetcher } = setup();
    fetcher.mockResolvedValueOnce(json({ access_token: "bearer", expires_in: 3600 })).mockResolvedValueOnce(json({ ...details, status }));
    await expect(provider.get("B123")).resolves.toEqual({ code: "B123", amountIsk: 5000, currency: "ISK", reference: input.reference, status: normalized, providerStatus: String(status) });
    expect(fetcher.mock.calls[1][0]).toBe("https://sandbox-transactions-api.mypos.com/v1.1/online-payments/payment-request/B123");
  });

  it.each([{ ...details, code: "OTHER" }, { ...details, amount: "5000" }, { ...details, currency: "EUR" }, { ...details, status: "Paid" }, { ...details, status: "4" }, { ...details, status: null }, { ...details, booking_text: null }, { ...details, qr_generated: true }])("never treats malformed or Gateway-style details as proof of payment", async (response) => {
    const { provider, fetcher } = setup();
    fetcher.mockResolvedValueOnce(json({ access_token: "bearer", expires_in: 3600 })).mockResolvedValueOnce(json(response));
    await expect(provider.get("B123")).rejects.toMatchObject({ code: "payment_invalid_response" });
  });

  it("renews tokens using their numeric or numeric-string lifetime", async () => {
    vi.useFakeTimers();
    const { provider, fetcher } = setup();
    await provider.get("B123");
    await provider.get("B123");
    expect(fetcher).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(86_371_000);
    await provider.get("B123");
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("refreshes a read once after 401, with a new request UUID", async () => {
    const { provider, fetcher } = setup();
    await provider.get("B123");
    fetcher.mockResolvedValueOnce(json({}, 401));
    await provider.get("B123");
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/oauth/token"))).toHaveLength(2);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/payment-request/B123"))).toHaveLength(3);
  });

  it("does not retry a permission-denied read or guess alternate Basic encodings", async () => {
    const { provider, fetcher } = setup();
    await provider.get("B123");
    fetcher.mockResolvedValueOnce(json({}, 403));
    await expect(provider.get("B123")).rejects.toMatchObject({ code: "payment_permission_denied" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([408, 500, 502])("treats a failed read (%s) as an outage without retrying", async (status) => {
    const { provider, fetcher } = setup();
    fetcher.mockResolvedValueOnce(json({ access_token: "bearer", expires_in: "86400" }))
      .mockResolvedValueOnce(json({ private_provider_message: "not exposed" }, status));
    await expect(provider.get("B123")).rejects.toMatchObject({ code: "payment_provider_unavailable", uncertain: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([{}, { access_token: "bearer", expires_in: "invalid" }, { access_token: "bearer", expires_in: 0 }])("rejects invalid token responses without further requests", async (token) => {
    const { provider, fetcher } = setup();
    fetcher.mockResolvedValueOnce(json(token));
    await expect(provider.get("B123")).rejects.toMatchObject({ code: "payment_invalid_auth_response" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps production read-only unless live creation is explicitly enabled", async () => {
    const { provider, fetcher } = setup({ config: { ...config, environment: "production" } });
    await expect(provider.create(input)).rejects.toMatchObject({ code: "live_payments_disabled" });
    expect(fetcher).not.toHaveBeenCalled();
    await provider.get("B123");
    expect(fetcher.mock.calls[0][0]).toBe("https://auth-api.mypos.com/oauth/token");
    expect(fetcher.mock.calls[1][0]).toBe("https://transactions-api.mypos.com/v1.1/online-payments/payment-request/B123");
  });

  it("uses only production hosts and returned production URLs when explicitly enabled", async () => {
    const { provider, fetcher } = setup({ config: { ...config, environment: "production", livePaymentsEnabled: true } });
    await provider.prepare(input);
    fetcher.mockResolvedValueOnce(json({ ...receipt, payment_request_url: "https://mypos.eu/pr/B123" }));
    await expect(provider.create(input)).resolves.toEqual({ code: "B123", url: "https://mypos.eu/pr/B123" });
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("sandbox"))).toBe(true);
  });
});

describe("REST configuration and input boundaries", () => {
  it("ignores old Gateway flags and stays disabled by default", () => {
    vi.stubEnv("MYPOS_LEGACY_ENABLED", "");
    vi.stubEnv("MYPOS_PAYMENT_REQUEST_ENABLED", "true");
    expect(getMyPosConfig).toThrow("payments_disabled");
  });
  it("requires only merchant credentials and defaults production writes to disabled", () => {
    vi.stubEnv("MYPOS_LEGACY_ENABLED", "true");
    vi.stubEnv("MYPOS_REST_ENV", "sandbox");
    vi.stubEnv("MYPOS_REST_CLIENT_ID", "merchant_client");
    vi.stubEnv("MYPOS_REST_CLIENT_SECRET", "merchant_secret");
    vi.stubEnv("MYPOS_LIVE_PAYMENTS_ENABLED", "false");
    expect(getMyPosConfig()).toEqual(config);
  });
  it.each(["demo", "test", "https://attacker.example"])("rejects ambiguous environment %s", (environment) => {
    vi.stubEnv("MYPOS_LEGACY_ENABLED", "true");
    vi.stubEnv("MYPOS_REST_ENV", environment);
    expect(getMyPosConfig).toThrow("payment_configuration_error");
  });
  it.each(["", "0", "12.5", "-10", "1e3", "2147483648"])("does not invent a fixed fee from %s", (value) => {
    vi.stubEnv("MYPOS_INITIAL_FEE_ISK", value);
    expect(getInitialFeeIsk).toThrow("initial_fee_not_configured");
  });
  it("reads the existing fixed whole-ISK fee", () => {
    vi.stubEnv("MYPOS_INITIAL_FEE_ISK", " 5000 ");
    expect(getInitialFeeIsk()).toBe(5000);
  });
  it("forbids initial-price overrides and client-paid assertions", () => {
    const base = { jobId: "30000000-0000-4000-8000-000000000001", purpose: "initial_fee" };
    expect(createPaymentSchema.safeParse({ ...base, amountIsk: 1 }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, status: "paid" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, purpose: "service", amountIsk: 9999 }).success).toBe(true);
  });
});
