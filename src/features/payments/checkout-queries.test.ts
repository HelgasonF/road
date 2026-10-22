import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServicePaymentSummary, getInitialCheckoutSummary, hasPaidInitialForIntake } from "./checkout-queries";
import type { PaymentRequest } from "./types";

vi.mock("server-only", () => ({}));
vi.mock("./collection-config", () => ({ isCollectionEnabled: () => true, requireReconciliationConfig: () => ({ environment: "production", clientId: "merchant" }) }));
const maybeSingle = vi.fn();
const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle };
const from = vi.fn(() => query);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
const get = vi.fn();
vi.mock("./store", () => ({ createPaymentStore: () => ({ get }) }));
const token = "A".repeat(43);
const payment = { environment: "production", merchantId: "merchant", providerApi: "rest_v1_1", purpose: "service", amountIsk: 27000, status: "pending", paymentUrl: "https://mypos.eu/pr/B123" } as PaymentRequest;
const page = { payment_request_id: "payment", description: "Jump start", vehicle_registration: "AB123", expires_at: "2099-01-01T00:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); get.mockResolvedValue(payment); maybeSingle.mockResolvedValue({ data: { status: "new" }, error: null }); });

describe("private payment page authorization", () => {
  it("rejects malformed bearer tokens before database access", async () => {
    expect(await getServicePaymentSummary("job-id")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("rejects expired page links before accessing the payment record", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { ...page, expires_at: "2000-01-01T00:00:00Z" }, error: null });
    expect(await getServicePaymentSummary(token)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
  it("rejects a valid token associated with a different merchant account", async () => {
    maybeSingle.mockResolvedValueOnce({ data: page, error: null });
    get.mockResolvedValueOnce({ ...payment, merchantId: "other-account" });
    expect(await getServicePaymentSummary(token)).toBeNull();
  });
  it("returns only the summary, without merchant identifiers or raw tokens", async () => {
    maybeSingle.mockResolvedValueOnce({ data: page, error: null });
    const result = await getServicePaymentSummary(token);
    expect(result).toMatchObject({ amountIsk: 27000, description: "Jump start", checkoutUrl: payment.paymentUrl });
    expect(result).not.toHaveProperty("merchantId");
    expect(result).not.toHaveProperty("jobId");
    expect(query.eq).toHaveBeenCalledWith("token_hash", expect.stringMatching(/^[a-f0-9]{64}$/));
  });
  it("does not reveal a revoked intake draft", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "link", expires_at: "2099-01-01T00:00:00Z", revoked_at: "2026-10-21T00:00:00Z" }, error: null });
    expect(await getInitialCheckoutSummary(token)).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledOnce();
  });
  it("stops offering checkout when the job was cancelled", async () => {
    maybeSingle.mockResolvedValueOnce({ data: page, error: null }).mockResolvedValueOnce({ data: { status: "cancelled" }, error: null });
    expect(await getServicePaymentSummary(token)).toMatchObject({ checkoutUrl: null });
  });
  it("recognizes a previously paid initial fee for a valid correction link under the exact account", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { job_id: "job", expires_at: "2099-01-01T00:00:00Z", revoked_at: null, submitted_at: null }, error: null })
      .mockResolvedValueOnce({ data: { id: "paid-payment" }, error: null });
    expect(await hasPaidInitialForIntake(token)).toBe(true);
    expect(query.eq).toHaveBeenCalledWith("purpose", "initial_fee");
    expect(query.eq).toHaveBeenCalledWith("environment", "production");
    expect(query.eq).toHaveBeenCalledWith("merchant_id", "merchant");
    expect(query.eq).toHaveBeenCalledWith("status", "paid");
  });
});
