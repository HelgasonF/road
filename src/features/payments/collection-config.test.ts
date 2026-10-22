import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCustomerPaymentSettings, requireCollectionConfig, requireReconciliationConfig } from "./collection-config";
vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "false"); vi.stubEnv("MYPOS_COLLECTION_ENABLED", "true");
  vi.stubEnv("MYPOS_LEGACY_ENABLED", "true"); vi.stubEnv("MYPOS_REST_ENV", "production");
  vi.stubEnv("MYPOS_REST_CLIENT_ID", "test-merchant"); vi.stubEnv("MYPOS_REST_CLIENT_SECRET", "test-secret");
  vi.stubEnv("MYPOS_LIVE_PAYMENTS_ENABLED", "false"); vi.stubEnv("MYPOS_INITIAL_FEE_ISK", "5000");
});
afterEach(() => vi.unstubAllEnvs());

describe("collection enablement", () => {
  it("allows existing-payment reconciliation while production creation remains disabled", () => {
    expect(requireReconciliationConfig().environment).toBe("production");
    expect(() => requireCollectionConfig()).toThrow("live_payments_disabled");
    expect(getCustomerPaymentSettings()).toEqual({ enabled: true, ready: false, amountIsk: null });
  });
  it("exposes only safe display settings after explicit enablement", () => {
    vi.stubEnv("MYPOS_LIVE_PAYMENTS_ENABLED", "true");
    expect(getCustomerPaymentSettings()).toEqual({ enabled: true, ready: true, amountIsk: 5000 });
  });
  it("does not silently fall back to unpaid intake when the fixed fee is missing", () => {
    vi.stubEnv("MYPOS_LIVE_PAYMENTS_ENABLED", "true"); vi.stubEnv("MYPOS_INITIAL_FEE_ISK", "");
    expect(getCustomerPaymentSettings()).toEqual({ enabled: true, ready: false, amountIsk: null });
  });
  it.each(["disabled", "demo"])("keeps the %s application outside the collection flow", (mode) => {
    vi.stubEnv(mode === "demo" ? "DEMO_MODE" : "MYPOS_COLLECTION_ENABLED", mode === "demo" ? "true" : "false");
    expect(getCustomerPaymentSettings()).toEqual({ enabled: false, ready: false, amountIsk: null });
    expect(() => requireReconciliationConfig()).toThrow("payments_disabled");
  });
});
