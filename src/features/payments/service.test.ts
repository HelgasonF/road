import { describe, expect, it, vi } from "vitest";
import { createPaymentService } from "./service";
import { PaymentError } from "./mypos-config";
import type { PaymentStore } from "./store";
import type { PaymentAccount, PaymentProvider, PaymentRequest, ProviderPaymentDetails } from "./types";

vi.mock("server-only", () => ({}));

const account: PaymentAccount = {
  environment: "sandbox", merchantId: "merchant", providerApi: "rest_v1_1",
};
const input = { jobId: "30000000-0000-4000-8000-000000000001", purpose: "initial_fee" as const, amountIsk: 5000, createdBy: "00000000-0000-4000-8000-000000000001" };
const initial: PaymentRequest = {
  id: "40000000-0000-4000-8000-000000000001", jobId: input.jobId, purpose: "initial_fee", ...account,
  amountIsk: 5000, currency: "ISK", reference: "IRA-test",
  providerCode: null, paymentUrl: null, status: "creating", providerStatus: null, errorCode: null,
  createdAt: "2026-10-20T12:00:00Z", lastVerifiedAt: null, paidAt: null,
};

function setup() {
  let row: PaymentRequest | null = null;
  const store = {
    reserve: vi.fn(async () => {
      const claimed = row === null;
      row ??= { ...initial };
      return { claimed, request: { ...row } };
    }),
    finish: vi.fn(async (_id, outcome) => {
      row = { ...row!, status: outcome.status, providerCode: outcome.code ?? null, paymentUrl: outcome.url ?? null, errorCode: outcome.errorCode ?? null };
      return row;
    }),
    get: vi.fn(async () => row),
    listForJob: vi.fn(async () => row ? [row] : []),
    pending: vi.fn(async () => row ? [row] : []),
    record: vi.fn(async (_id, details) => {
      row = { ...row!, status: details.status, providerStatus: details.providerStatus };
      return row;
    }),
  } satisfies PaymentStore;
  const provider = {
    account,
    prepare: vi.fn(async () => {}),
    create: vi.fn(async () => ({ code: "B123", url: "https://demo.mypos.eu/en/pr/B123" })),
    get: vi.fn(async (): Promise<ProviderPaymentDetails> => ({ code: "B123", amountIsk: 5000, currency: "ISK", reference: "IRA-test", status: "paid", providerStatus: "4" })),
  } satisfies PaymentProvider;
  return { service: createPaymentService(provider, store), provider, store };
}

describe("payment collection service", () => {
  it.each(["payment_customer_name_required", "payment_isk_unavailable", "payment_language_unsupported"])("does not consume a collection slot when preflight fails: %s", async (code) => {
    const { service, provider, store } = setup();
    provider.prepare.mockRejectedValueOnce(new PaymentError(code));
    await expect(service.create(input)).rejects.toMatchObject({ code });
    expect(store.reserve).not.toHaveBeenCalled();
    expect(provider.create).not.toHaveBeenCalled();
    await expect(service.create(input)).resolves.toMatchObject({ providerCode: "B123" });
  });

  it("persists the provider's exact code and URL", async () => {
    const { service, store, provider } = setup();
    const result = await service.create(input);
    expect(provider.create).toHaveBeenCalledWith(expect.objectContaining({ amountIsk: 5000, reference: "IRA-test" }));
    expect(store.finish).toHaveBeenCalledWith(initial.id, { reference: initial.reference, status: "pending", code: "B123", url: "https://demo.mypos.eu/en/pr/B123" });
    expect(result.providerCode).toBe("B123");
  });

  it("allows only one external POST for concurrent and repeated clicks", async () => {
    const { service, provider } = setup();
    const results = await Promise.allSettled([service.create(input), service.create(input)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(provider.create).toHaveBeenCalledTimes(1);
    const repeated = await service.create(input);
    expect(repeated.providerCode).toBe("B123");
    expect(provider.create).toHaveBeenCalledTimes(1);
  });

  it("locks the chosen amount instead of silently changing a live request", async () => {
    const { service, provider } = setup();
    await service.create(input);
    await expect(service.create({ ...input, amountIsk: 8000 })).rejects.toMatchObject({ code: "payment_amount_locked" });
    expect(provider.create).toHaveBeenCalledTimes(1);
  });

  it.each(["expired", "cancelled"] as const)("does not offer a closed %s link as a new request", async (status) => {
    const { service, provider, store } = setup();
    store.reserve.mockResolvedValueOnce({ claimed: false, request: { ...initial, status, providerCode: "B123", paymentUrl: "https://demo.mypos.eu/en/pr/B123" } });
    await expect(service.create(input)).rejects.toMatchObject({ code: "payment_request_closed" });
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("never recreates a request after an ambiguous timeout", async () => {
    const { service, provider, store } = setup();
    provider.create.mockRejectedValueOnce(new PaymentError("payment_provider_unavailable", true));
    await expect(service.create(input)).rejects.toMatchObject({ uncertain: true });
    expect(store.finish).toHaveBeenCalledWith(initial.id, { reference: initial.reference, status: "creation_unknown", errorCode: "payment_provider_unavailable", diagnostics: {} });
    await expect(service.create(input)).rejects.toMatchObject({ code: "payment_creation_unresolved" });
    expect(provider.create).toHaveBeenCalledTimes(1);
  });

  it("requires an atomic store claim before retrying a definitively failed create", async () => {
    const { service, provider, store } = setup();
    provider.create.mockRejectedValueOnce(new PaymentError("payment_authentication_failed"));
    await expect(service.create(input)).rejects.toMatchObject({ code: "payment_authentication_failed" });
    expect(store.finish).toHaveBeenCalledWith(initial.id, { reference: initial.reference, status: "creation_failed", errorCode: "payment_authentication_failed", diagnostics: {} });
    await expect(service.create(input)).rejects.toMatchObject({ code: "payment_creation_unresolved" });
    expect(provider.create).toHaveBeenCalledTimes(1);
  });

  it("does not leak an untracked link or release the reservation when persistence fails", async () => {
    const { service, provider, store } = setup();
    store.finish.mockRejectedValueOnce(new Error("database connection lost"));
    await expect(service.create(input)).rejects.toMatchObject({ code: "payment_persistence_uncertain" });
    await expect(service.create(input)).rejects.toMatchObject({ code: "payment_creation_unresolved" });
    expect(provider.create).toHaveBeenCalledTimes(1);
  });

  it("does not reuse or verify another merchant/environment's request", async () => {
    const { service, provider, store } = setup();
    store.reserve.mockResolvedValueOnce({ claimed: false, request: { ...initial, merchantId: "other" } });
    await expect(service.create(input)).rejects.toMatchObject({ code: "payment_account_mismatch" });
    await expect(service.verify({ ...initial, environment: "production" })).rejects.toMatchObject({ code: "payment_account_mismatch" });
    await expect(service.verify({ ...initial, providerApi: "another_api" })).rejects.toMatchObject({ code: "payment_account_mismatch" });
    expect(provider.create).not.toHaveBeenCalled();
    expect(provider.get).not.toHaveBeenCalled();
  });

  it.each([
    { code: "OTHER" }, { amountIsk: 1 }, { currency: "EUR" }, { reference: "another-job" },
  ])("rejects a Paid response for different payment details", async (override) => {
    const { service, provider, store } = setup();
    const request = await service.create(input);
    provider.get.mockResolvedValueOnce({ code: "B123", amountIsk: 5000, currency: "ISK", reference: "IRA-test", status: "paid", providerStatus: "4", ...override } as Awaited<ReturnType<PaymentProvider["get"]>>);
    await expect(service.verify(request)).rejects.toMatchObject({ code: "payment_response_mismatch" });
    expect(store.record).not.toHaveBeenCalled();
  });

  it("only records Paid after matching an authoritative provider read", async () => {
    const { service, provider, store } = setup();
    const request = await service.create(input);
    const paid = await service.verify(request);
    expect(paid.status).toBe("paid");
    await service.verify(paid);
    expect(provider.get).toHaveBeenCalledTimes(1);
    expect(store.record).toHaveBeenCalledTimes(1);
  });

  it.each(["payment_rate_limited", "payment_provider_unavailable", "payment_permission_denied", "payment_authentication_failed"])("stops reconciliation on %s without creating payments", async (code) => {
    const { service, provider, store } = setup();
    const request = await service.create(input);
    store.pending.mockResolvedValue([request, request]);
    provider.get.mockRejectedValueOnce(new PaymentError(code));
    await expect(service.reconcile()).resolves.toEqual({ verified: 0, failed: 1 });
    expect(provider.get).toHaveBeenCalledTimes(1);
    expect(provider.create).toHaveBeenCalledTimes(1);
  });
});
