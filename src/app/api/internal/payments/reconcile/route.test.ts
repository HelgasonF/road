// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireReconciliationConfig } from "@/features/payments/collection-config";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/payments/collection-config", () => ({ requireReconciliationConfig: vi.fn(() => ({})) }));
vi.mock("@/features/payments/mypos", () => ({ MyPosProvider: class {} }));
vi.mock("@/features/payments/store", () => ({ createPaymentStore: vi.fn() }));
vi.mock("@/features/payments/checkout-store", () => ({ createCheckoutStore: vi.fn() }));
const reconcile = vi.fn();
vi.mock("@/features/payments/checkout-service", () => ({ createCheckoutService: () => ({ reconcile }) }));
const secret = "test-worker-secret-which-is-not-a-live-secret";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("PAYMENT_WORKER_SECRET", secret); });

describe("unattended payment worker boundary", () => {
  it.each([undefined, "Bearer wrong-token"])("rejects unauthenticated invocations before account or storage access", async (authorization) => {
    const request = new Request("http://localhost/api/internal/payments/reconcile", { method: "POST", headers: authorization ? { authorization } : {} });
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(requireReconciliationConfig).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });
  it("runs without a customer or staff session and reports only safe counts", async () => {
    reconcile.mockResolvedValue({ verified: 2, submitted: 1, failed: 0, reviewRequired: 0 });
    const response = await POST(new Request("http://localhost/api/internal/payments/reconcile", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ verified: 2, submitted: 1, failed: 0, reviewRequired: 0 });
  });
  it("redacts unexpected failures", async () => {
    reconcile.mockRejectedValue(new Error("raw account credential customer data"));
    const response = await POST(new Request("http://localhost/api/internal/payments/reconcile", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "payment_worker_unavailable" });
  });
});
