import { describe, expect, it, vi } from "vitest";
import { createCheckoutService } from "./checkout-service";
import type { PaymentProvider, PaymentRequest, ProviderPaymentDetails } from "./types";
import type { CheckoutStore } from "./checkout-store";
import type { PaymentStore } from "./store";

vi.mock("server-only", () => ({}));

const request = {
  id: "40000000-0000-4000-8000-000000000001", jobId: "30000000-0000-4000-8000-000000000001",
  purpose: "initial_fee", environment: "sandbox", merchantId: "merchant", providerApi: "rest_v1_1",
  amountIsk: 5000, currency: "ISK", reference: "IRA-test", providerCode: null, paymentUrl: null,
  status: "creating", providerStatus: null, createdAt: "2026-10-21T12:00:00Z", lastVerifiedAt: null,
  paidAt: null, errorCode: null,
} satisfies PaymentRequest;

function setup() {
  const provider: PaymentProvider = {
    account: { environment: "sandbox", merchantId: "merchant", providerApi: "rest_v1_1" },
    prepare: vi.fn(async () => {}),
    create: vi.fn(async () => ({ code: "B123", url: "https://demo.mypos.eu/pr/B123" })),
    get: vi.fn(async (): Promise<ProviderPaymentDetails> => ({ code: "B123", amountIsk: 5000, currency: "ISK", reference: "IRA-test", providerStatus: "4", status: "paid" })),
  };
  const payments = {
    finish: vi.fn(async () => ({ ...request, status: "pending", providerCode: "B123", paymentUrl: "https://demo.mypos.eu/pr/B123" })),
    record: vi.fn(async () => ({ ...request, status: "paid", paidAt: "2026-10-21T12:01:00Z" })),
  } as unknown as PaymentStore;
  const checkouts = {
    prepareInitial: vi.fn(async () => ({ claimed: true, request })),
    prepareService: vi.fn(async () => ({ claimed: true, request: { ...request, purpose: "service" } })),
    claimDue: vi.fn(async () => []),
    finalize: vi.fn(async () => "submitted"),
  } as unknown as CheckoutStore;
  return { provider, payments, checkouts, service: createCheckoutService(provider, payments, checkouts) };
}

describe("customer checkout orchestration", () => {
  it("durably saves and associates the draft before any external payment creation", async () => {
    const { provider, checkouts, service } = setup();
    await service.startInitial({ tokenHash: "a".repeat(64), amountIsk: 5000, language: "is", details: { customerName: "Customer" } as never });
    expect(checkouts.prepareInitial).toHaveBeenCalledWith(expect.objectContaining({ amountIsk: 5000, language: "is", merchantId: "merchant", details: { customerName: "Customer" } }));
    expect(vi.mocked(checkouts.prepareInitial).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(provider.create).mock.invocationCallOrder[0]);
    expect(provider.create).toHaveBeenCalledWith(expect.objectContaining({ customerName: "Customer", language: "is" }));
    expect(checkouts.finalize).not.toHaveBeenCalled();
  });

  it("does not create a request when draft persistence fails", async () => {
    const { provider, checkouts, service } = setup();
    vi.mocked(checkouts.prepareInitial).mockRejectedValue(new Error("unavailable"));
    await expect(service.startInitial({ tokenHash: "a".repeat(64), amountIsk: 5000, language: "en", details: { customerName: "Customer" } as never })).rejects.toThrow();
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("refuses an uncertain reserved request without a second creation POST", async () => {
    const { provider, checkouts, service } = setup();
    vi.mocked(checkouts.prepareInitial).mockResolvedValue({ claimed: false, request: { ...request, status: "creation_unknown" } });
    await expect(service.startInitial({ tokenHash: "a".repeat(64), amountIsk: 5000, language: "en", details: { customerName: "Customer" } as never })).rejects.toMatchObject({ code: "payment_creation_unresolved" });
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("a worker finalizes a verified paid draft without any customer browser or session", async () => {
    const { checkouts, service, provider } = setup();
    vi.mocked(checkouts.claimDue).mockResolvedValue([{ ...request, status: "pending", providerCode: "B123" }]);
    expect(await service.reconcile()).toMatchObject({ verified: 1, submitted: 1, failed: 0 });
    expect(provider.get).toHaveBeenCalledWith("B123");
    expect(checkouts.finalize).toHaveBeenCalledWith(request.id);
  });

  it("retries finalization of an already verified Paid row after a previous worker interruption", async () => {
    const { checkouts, service, provider } = setup();
    vi.mocked(checkouts.claimDue).mockResolvedValue([{ ...request, status: "paid", providerCode: "B123" }]);
    expect(await service.reconcile()).toMatchObject({ submitted: 1 });
    expect(provider.get).not.toHaveBeenCalled();
    expect(checkouts.finalize).toHaveBeenCalledOnce();
  });

  it.each(["pending", "seen", "failed", "expired", "cancelled", "unknown"] as const)("does not submit a draft after a %s observation", async (status) => {
    const { checkouts, payments, service, provider } = setup();
    vi.mocked(checkouts.claimDue).mockResolvedValue([{ ...request, status: "pending", providerCode: "B123" }]);
    vi.mocked(provider.get).mockResolvedValue({ code: "B123", amountIsk: 5000, currency: "ISK", reference: "IRA-test", providerStatus: "1", status });
    vi.mocked(payments.record).mockResolvedValue({ ...request, status });
    await service.reconcile();
    expect(checkouts.finalize).not.toHaveBeenCalled();
  });

  it("does not finalize after a mismatched payment response", async () => {
    const { checkouts, service, provider } = setup();
    vi.mocked(checkouts.claimDue).mockResolvedValue([{ ...request, status: "pending", providerCode: "B123" }]);
    vi.mocked(provider.get).mockResolvedValue({ code: "B123", amountIsk: 1, currency: "ISK", reference: "IRA-test", providerStatus: "4", status: "paid" });
    expect(await service.reconcile()).toMatchObject({ failed: 1, submitted: 0 });
    expect(checkouts.finalize).not.toHaveBeenCalled();
  });
});
