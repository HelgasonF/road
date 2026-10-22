import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutStore } from "./checkout-store";
vi.mock("server-only", () => ({}));
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const account = { environment: "sandbox" as const, merchantId: "merchant", providerApi: "rest_v1_1" };
const row = {
  id: "40000000-0000-4000-8000-000000000001", job_id: "30000000-0000-4000-8000-000000000001",
  purpose: "initial_fee", provider: "mypos", environment: "sandbox", merchant_id: "merchant", provider_api: "rest_v1_1",
  amount_isk: 5000, currency: "ISK", reference: "IRA-test", provider_code: null, payment_url: null,
  status: "creating", provider_status: null, error_code: null, created_by: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-10-21T12:00:00Z", last_verified_at: null, paid_at: null,
};
beforeEach(() => vi.clearAllMocks());

describe("checkout persistence boundary", () => {
  it("maps the durable initial reservation to the same safe payment contract", async () => {
    rpc.mockResolvedValueOnce({ data: { claimed: true, request: row }, error: null });
    const result = await createCheckoutStore().prepareInitial({ ...account, amountIsk: 5000, tokenHash: "a".repeat(64), details: { customerName: "Customer" } as never, language: "is" });
    expect(result).toMatchObject({ claimed: true, request: { amountIsk: 5000, jobId: row.job_id } });
    expect(result.request).not.toHaveProperty("created_by");
    expect(rpc).toHaveBeenCalledWith("prepare_customer_payment_intake", expect.objectContaining({ p_token_hash: "a".repeat(64), p_details: { customerName: "Customer" }, p_language: "is" }));
  });
  it("passes only the hashed page token to the atomic second-payment reservation", async () => {
    rpc.mockResolvedValueOnce({ data: { claimed: false, request: row }, error: null });
    await createCheckoutStore().prepareService({ ...account, jobId: row.job_id, amountIsk: 5000, createdBy: row.created_by, description: "Jump start", tokenHash: "b".repeat(64), expiresAt: "2026-10-22T12:00:00Z" });
    expect(rpc).toHaveBeenCalledWith("prepare_service_payment_page", expect.objectContaining({ p_token_hash: "b".repeat(64), p_description: "Jump start", p_created_by: row.created_by }));
  });
  it.each(["payment_details_locked", "payment_link_unavailable"])("retains the safe %s diagnostic", async (message) => {
    rpc.mockResolvedValueOnce({ data: null, error: { message } });
    await expect(createCheckoutStore().prepareInitial({ ...account, amountIsk: 5000, tokenHash: "a".repeat(64), details: {} as never, language: "en" })).rejects.toMatchObject({ code: message });
  });
  it("never leaks database exception contents or malformed reservation data", async () => {
    rpc.mockResolvedValueOnce({ data: { claimed: "true", request: row }, error: { message: "raw secret customer data" } });
    await expect(createCheckoutStore().prepareInitial({ ...account, amountIsk: 5000, tokenHash: "a".repeat(64), details: {} as never, language: "en" })).rejects.toMatchObject({ message: "payment_storage_error" });
  });
  it("claims background candidates under the exact configured account", async () => {
    rpc.mockResolvedValueOnce({ data: [row], error: null });
    expect(await createCheckoutStore().claimDue(account)).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("claim_due_job_payments", { p_environment: "sandbox", p_merchant_id: "merchant", p_provider_api: "rest_v1_1" });
  });
  it("rejects an invalid worker candidate response", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(createCheckoutStore().claimDue(account)).rejects.toMatchObject({ message: "payment_storage_error" });
  });
  it.each(["submitted", "review_required", "not_ready", "none"])("preserves the %s finalization outcome", async (data) => {
    rpc.mockResolvedValueOnce({ data, error: null });
    expect(await createCheckoutStore().finalize(row.id)).toBe(data);
  });
  it("fails safely on an invalid finalization response", async () => {
    rpc.mockResolvedValueOnce({ data: { paid: true }, error: null });
    await expect(createCheckoutStore().finalize(row.id)).rejects.toMatchObject({ message: "payment_finalization_unavailable" });
  });
});
