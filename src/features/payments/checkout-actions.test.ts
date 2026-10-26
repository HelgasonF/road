import { beforeEach, describe, expect, it, vi } from "vitest";
import { startCustomerCheckoutAction, resumeCustomerCheckoutAction, createServicePaymentLinkAction } from "./checkout-actions";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { requireCollectionConfig } from "./collection-config";
import { PaymentError } from "./mypos-config";
import { getActiveCustomerLinkByToken } from "@/features/customer-intake/queries";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedStaffSession: vi.fn() }));
vi.mock("@/features/customer-intake/rate-limit", () => ({ customerLinkRequestAllowed: vi.fn(async () => true), customerRateLimitError: "rate limited" }));
vi.mock("@/features/customer-intake/queries", () => ({ getActiveCustomerLinkByToken: vi.fn(async () => ({ id: "valid-link" })) }));
vi.mock("./collection-config", () => ({ requireCollectionConfig: vi.fn(() => ({ environment: "sandbox" })), isCollectionEnabled: vi.fn(() => true) }));
vi.mock("./checkout-queries", () => ({ hasPaidInitialForIntake: vi.fn(async () => false) }));
vi.mock("./mypos-config", async (original) => ({ ...await original<typeof import("./mypos-config")>(), getInitialFeeIsk: () => 5000 }));
vi.mock("./mypos", () => ({ MyPosProvider: class {} }));
vi.mock("./store", () => ({ createPaymentStore: vi.fn() }));
vi.mock("./checkout-store", () => ({ createCheckoutStore: vi.fn() }));
const startInitial = vi.fn();
const startService = vi.fn();
vi.mock("./checkout-service", () => ({ createCheckoutService: () => ({ startInitial, startService }) }));
const maybeSingle = vi.fn();
const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => query }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { customer_name: "Existing Customer" }, error: null }) }) }) }) }) }));

const input = {
  token: "A".repeat(43), language: "is", customerName: "Customer", customerPhone: "+3545550101",
  vehicleRegistration: "AB123", vehicleMake: "Ford", rentalCompany: "", peopleCount: 1,
  latitude: 64.14, longitude: -21.9, locationLabel: "Reykjavík", locationSource: "map_pin",
  requiredCapability: "jump_start", customerNotes: "Battery is flat.",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireCollectionConfig).mockReturnValue({ environment: "sandbox", clientId: "m", clientSecret: "s", livePaymentsEnabled: false });
  startInitial.mockResolvedValue({ paymentUrl: "https://demo.mypos.eu/pr/B123" });
  startService.mockResolvedValue({ paymentUrl: "https://demo.mypos.eu/pr/B456" });
});

describe("checkout action authorization", () => {
  it("resumes the exact saved draft while keeping its original checkout language and name", async () => {
    const details = Object.fromEntries(Object.entries(input).filter(([key]) => !["token", "language"].includes(key)));
    maybeSingle.mockResolvedValueOnce({ data: { id: "link" }, error: null })
      .mockResolvedValueOnce({ data: { details: { ...details, customerName: "Þórður Ægir" }, language: "is" }, error: null });
    expect(await resumeCustomerCheckoutAction({ token: input.token, language: "en" })).toMatchObject({ ok: true });
    expect(startInitial).toHaveBeenCalledWith(expect.objectContaining({ language: "is", details: expect.objectContaining({ customerName: "Þórður Ægir" }) }));
  });
  it("rejects an expired/revoked retry token before reading a draft or contacting myPOS", async () => {
    vi.mocked(getActiveCustomerLinkByToken).mockResolvedValueOnce(null);
    expect(await resumeCustomerCheckoutAction({ token: input.token, language: "is" })).toMatchObject({ ok: false, errorCode: "payment_link_unavailable" });
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(startInitial).not.toHaveBeenCalled();
  });
  it("does not accept replacement customer details in a retry request", async () => {
    expect(await resumeCustomerCheckoutAction({ token: input.token, language: "is", customerName: "Changed" })).toMatchObject({ ok: false, errorCode: "payment_invalid_input" });
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(startInitial).not.toHaveBeenCalled();
  });
  it("returns Icelandic checkout errors for the Icelandic form", async () => {
    startInitial.mockRejectedValueOnce(new PaymentError("payment_details_locked"));
    expect(await startCustomerCheckoutAction(input)).toMatchObject({ ok: false, error: expect.stringContaining("Hafðu samband við aðgerðastjórn") });
  });
  it("accepts a resolved search location without changing the payment flow", async () => {
    expect(await startCustomerCheckoutAction({ ...input, locationSource: "search", locationLabel: "Keflavík · Bær · Approximate location" })).toMatchObject({ ok: true });
    expect(startInitial).toHaveBeenCalledWith(expect.objectContaining({ amountIsk: 5000, details: expect.objectContaining({ locationSource: "search" }) }));
  });

  it("returns field validation details before starting any payment request", async () => {
    expect(await startCustomerCheckoutAction({ ...input, peopleCount: 0 })).toMatchObject({ ok: false, errorCode: "payment_invalid_input", fieldErrors: { peopleCount: expect.any(Array) } });
    expect(startInitial).not.toHaveBeenCalled();
  });

  it("derives the fixed amount on the server and removes the raw intake token from the stored draft", async () => {
    expect(await startCustomerCheckoutAction({ ...input, amountIsk: 1, paid: true })).toEqual({ ok: true, data: { checkoutUrl: "https://demo.mypos.eu/pr/B123" } });
    expect(startInitial).toHaveBeenCalledWith(expect.objectContaining({ amountIsk: 5000, language: "is", tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(startInitial.mock.calls[0][0].details).not.toHaveProperty("token");
    expect(startInitial.mock.calls[0][0].details).not.toHaveProperty("paid");
  });
  it("rejects an invalid private token before checkout", async () => {
    expect(await startCustomerCheckoutAction({ ...input, token: "job-id" })).toMatchObject({ ok: false, errorCode: "payment_invalid_input" });
    expect(startInitial).not.toHaveBeenCalled();
  });
  it("rejects a well-formed token with no active link before provider preparation", async () => {
    vi.mocked(getActiveCustomerLinkByToken).mockResolvedValueOnce(null);
    expect(await startCustomerCheckoutAction(input)).toMatchObject({ ok: false, errorCode: "payment_link_unavailable" });
    expect(startInitial).not.toHaveBeenCalled();
  });
  it("does not fall back to unpaid submission or create requests when production writes are disabled", async () => {
    vi.mocked(requireCollectionConfig).mockImplementation(() => { throw new PaymentError("live_payments_disabled"); });
    expect(await startCustomerCheckoutAction(input)).toMatchObject({ ok: false, errorCode: "live_payments_disabled" });
    expect(startInitial).not.toHaveBeenCalled();
  });
  it("requires a staff session for the second payment before accessing its account", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(null);
    expect(await createServicePaymentLinkAction({ jobId: "30000000-0000-4000-8000-000000000001", amountIsk: 27000, description: "Jump start" })).toMatchObject({ ok: false, errorCode: "staff_access_required" });
    expect(requireCollectionConfig).not.toHaveBeenCalled();
    expect(startService).not.toHaveBeenCalled();
  });
  it("returns a private application page for a staff-entered second amount", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" } as never);
    const result = await createServicePaymentLinkAction({ jobId: "30000000-0000-4000-8000-000000000001", amountIsk: 27000, description: "Jump start" });
    expect(result).toMatchObject({ ok: true, data: { path: expect.stringMatching(/^\/pay\/[A-Za-z0-9_-]{43}$/) } });
    expect(startService).toHaveBeenCalledWith(expect.objectContaining({ amountIsk: 27000, description: "Jump start", customerName: "Existing Customer", tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });
});
