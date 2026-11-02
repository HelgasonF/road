import { beforeEach, describe, expect, it, vi } from "vitest";
import { startCustomerCheckoutAction, resumeCustomerCheckoutAction, createServicePaymentLinkAction, replaceServicePaymentLinkAction, openServiceCheckoutAction } from "./checkout-actions";
import { getServicePaymentRequest } from "./checkout-queries";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { requireCollectionConfig } from "./collection-config";
import { PaymentError } from "./mypos-config";
import { getActiveCustomerLinkByToken } from "@/features/customer-intake/queries";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedStaffSession: vi.fn() }));
vi.mock("@/features/customer-intake/rate-limit", () => ({ customerLinkRequestAllowed: vi.fn(async () => true), customerRateLimitError: "rate limited" }));
vi.mock("@/features/customer-intake/queries", () => ({ getActiveCustomerLinkByToken: vi.fn(async () => ({ id: "valid-link" })) }));
vi.mock("./collection-config", () => ({ requireCollectionConfig: vi.fn(() => ({ environment: "sandbox" })), requireReconciliationConfig: vi.fn(() => ({ environment: "sandbox" })), isCollectionEnabled: vi.fn(() => true) }));
vi.mock("./checkout-queries", () => ({ hasPaidInitialForIntake: vi.fn(async () => false), getServicePaymentRequest: vi.fn() }));
vi.mock("./mypos-config", async (original) => ({ ...await original<typeof import("./mypos-config")>(), getInitialFeeIsk: () => 5000 }));
vi.mock("./mypos", () => ({ MyPosProvider: class {} }));
vi.mock("./store", () => ({ createPaymentStore: vi.fn() }));
vi.mock("./checkout-store", () => ({ createCheckoutStore: vi.fn() }));
const startInitial = vi.fn();
const startService = vi.fn();
const replaceService = vi.fn();
const verifyServicePayments = vi.fn();
vi.mock("./checkout-service", () => ({ createCheckoutService: () => ({ startInitial, startService, replaceService, verifyServicePayments }) }));
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
  startService.mockResolvedValue({ id: "40000000-0000-4000-8000-000000000001", paymentUrl: "https://demo.mypos.eu/pr/B456" });
  replaceService.mockResolvedValue({ id: "40000000-0000-4000-8000-000000000002", paymentUrl: "https://demo.mypos.eu/pr/B457" });
  verifyServicePayments.mockResolvedValue(undefined);
  vi.mocked(getServicePaymentRequest).mockResolvedValue(null);
});

describe("checkout action authorization", () => {
  const replacement = { jobId: "30000000-0000-4000-8000-000000000001", paymentId: "40000000-0000-4000-8000-000000000001", amountIsk: 32000, description: "Revised towing" };
  it("requires staff authorization before replacing the second payment", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(null);
    expect(await replaceServicePaymentLinkAction(replacement)).toMatchObject({ ok: false, errorCode: "staff_access_required" });
    expect(replaceService).not.toHaveBeenCalled();
    expect(requireCollectionConfig).not.toHaveBeenCalled();
  });
  it("binds replacement to the expected payment, verified staff and stored customer name", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" } as never);
    expect(await replaceServicePaymentLinkAction(replacement)).toMatchObject({ ok: true, data: { paymentId: "40000000-0000-4000-8000-000000000002", path: expect.stringMatching(/^\/pay\//) } });
    expect(replaceService).toHaveBeenCalledWith(expect.objectContaining({ ...replacement, customerName: "Existing Customer", createdBy: "00000000-0000-4000-8000-000000000001", tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(startService).not.toHaveBeenCalled();
  });
  it.each([{ paymentId: "invalid" }, { amountIsk: 0 }, { description: "x" }, { status: "paid" }])("rejects malformed replacement input %j", async (invalid) => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" } as never);
    expect(await replaceServicePaymentLinkAction({ ...replacement, ...invalid })).toMatchObject({ ok: false, errorCode: "payment_invalid_input" });
    expect(replaceService).not.toHaveBeenCalled();
  });
  it("rejects an old service token before provider verification", async () => {
    expect(await openServiceCheckoutAction({ token: "A".repeat(43) })).toMatchObject({ ok: false, errorCode: "payment_link_unavailable" });
    expect(verifyServicePayments).not.toHaveBeenCalled();
  });
  it("checks a service token again after provider verification to catch a concurrent replacement", async () => {
    vi.mocked(getServicePaymentRequest).mockResolvedValueOnce({ jobId: replacement.jobId } as never).mockResolvedValueOnce(null);
    expect(await openServiceCheckoutAction({ token: "A".repeat(43) })).toMatchObject({ ok: false, errorCode: "payment_link_unavailable" });
    expect(verifyServicePayments).toHaveBeenCalledWith(replacement.jobId);
    expect(getServicePaymentRequest).toHaveBeenCalledTimes(2);
  });
  it("does not return checkout when an older service request is Paid", async () => {
    vi.mocked(getServicePaymentRequest).mockResolvedValue({ jobId: replacement.jobId } as never);
    verifyServicePayments.mockRejectedValueOnce(new PaymentError("payment_already_paid"));
    expect(await openServiceCheckoutAction({ token: "A".repeat(43) })).toMatchObject({ ok: false, errorCode: "payment_already_paid" });
    expect(getServicePaymentRequest).toHaveBeenCalledOnce();
  });
  it("opens only the validated active provider URL and never accepts a browser-supplied amount", async () => {
    const token = "A".repeat(43);
    vi.mocked(getServicePaymentRequest).mockResolvedValue({ jobId: replacement.jobId, environment: "sandbox", status: "pending", paymentUrl: "https://demo.mypos.eu/pr/B456" } as never);
    expect(await openServiceCheckoutAction({ token, amountIsk: 1 })).toMatchObject({ ok: false, errorCode: "payment_invalid_input" });
    expect(await openServiceCheckoutAction({ token })).toEqual({ ok: true, data: { checkoutUrl: "https://demo.mypos.eu/pr/B456" } });
    expect(startService).not.toHaveBeenCalled();
    expect(replaceService).not.toHaveBeenCalled();
  });
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
