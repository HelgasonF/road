import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentStore } from "./store";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
const maybeSingle = vi.fn();
const result = vi.fn();
const query = {
  select: vi.fn(() => query), eq: vi.fn(() => query), not: vi.fn(() => query), in: vi.fn(() => query),
  or: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => result()), maybeSingle,
};
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from: () => query }) }));

const row = {
  id: "40000000-0000-4000-8000-000000000001", job_id: "30000000-0000-4000-8000-000000000001",
  purpose: "initial_fee", provider: "mypos", environment: "sandbox", merchant_id: "merchant", provider_api: "rest_v1_1",
  amount_isk: 5000, currency: "ISK", reference: "IRA-test", provider_code: "B123", payment_url: "https://demo.mypos.eu/en/pr/B123",
  status: "pending", provider_status: null, error_code: null, created_by: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-10-20T12:00:00Z", last_verified_at: null, paid_at: null,
};

beforeEach(() => vi.clearAllMocks());

describe("payment storage boundary", () => {
  it("returns only the caller DTO from an atomic reservation", async () => {
    rpc.mockResolvedValueOnce({ data: { claimed: true, request: row }, error: null });
    const outcome = await createPaymentStore().reserve({ jobId: row.job_id, purpose: "initial_fee", amountIsk: 5000, environment: "sandbox", merchantId: "merchant", providerApi: "rest_v1_1", createdBy: row.created_by });
    expect(outcome.claimed).toBe(true);
    expect(outcome.request).toMatchObject({ jobId: row.job_id, amountIsk: 5000, paymentUrl: row.payment_url });
    expect(outcome.request).not.toHaveProperty("created_by");
  });
  it.each([
    { data: null, error: { message: "database secret" } },
    { data: { claimed: true, request: { ...row, amount_isk: "5000" } }, error: null },
  ])("fails closed on storage errors and malformed reservation responses", async (response) => {
    rpc.mockResolvedValueOnce(response);
    await expect(createPaymentStore().reserve({ jobId: row.job_id, purpose: "initial_fee", amountIsk: 5000, environment: "sandbox", merchantId: "merchant", providerApi: "rest_v1_1", createdBy: row.created_by })).rejects.toMatchObject({ message: "payment_storage_error" });
  });
  it("persists an opaque safe error code instead of raw provider data", async () => {
    rpc.mockResolvedValueOnce({ data: { ...row, status: "creation_unknown", provider_code: null, payment_url: null }, error: null });
    await createPaymentStore().finish(row.id, { status: "creation_unknown", errorCode: "payment_provider_unavailable" });
    expect(rpc).toHaveBeenCalledWith("finish_job_payment_creation", { p_id: row.id, p_provider_code: null, p_payment_url: null, p_status: "creation_unknown", p_error_code: "payment_provider_unavailable" });
  });
  it("limits reconciliation candidates to one account/environment and ten requests", async () => {
    result.mockResolvedValueOnce({ data: [row], error: null });
    const pending = await createPaymentStore().pending("sandbox", "merchant", "rest_v1_1");
    expect(pending).toHaveLength(1);
    expect(query.eq.mock.calls).toEqual([["environment", "sandbox"], ["merchant_id", "merchant"], ["provider_api", "rest_v1_1"]]);
    expect(query.limit).toHaveBeenCalledWith(10);
  });
  it("records the provider response and observation timestamp without accepting a local paid flag", async () => {
    rpc.mockResolvedValueOnce({ data: { ...row, status: "paid", provider_status: "4", paid_at: "2026-10-20T13:00:00Z" }, error: null });
    await createPaymentStore().record(row.id, { code: "B123", amountIsk: 5000, currency: "ISK", reference: "IRA-test", status: "paid", providerStatus: "4" }, "2026-10-20T13:00:00Z");
    expect(rpc).toHaveBeenCalledWith("record_job_payment_status", expect.objectContaining({ p_provider_status: "4", p_status: "paid", p_reference: "IRA-test", p_amount_isk: 5000, p_checked_at: "2026-10-20T13:00:00Z" }));
  });
});
