import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { createJobPaymentRequestAction, getJobPaymentRequestsAction, reconcilePendingJobPaymentsAction, verifyJobPaymentRequestAction } from "./actions";
import { getInitialFeeIsk, getMyPosConfig } from "./mypos-config";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getVerifiedStaffSession: vi.fn() }));
vi.mock("@/lib/config", () => ({ isDemoMode: vi.fn(() => false) }));
vi.mock("./mypos-config", async (original) => ({ ...await original<typeof import("./mypos-config")>(), getMyPosConfig: vi.fn(), getInitialFeeIsk: vi.fn(() => 5000) }));
vi.mock("./mypos", () => ({ MyPosProvider: class {} }));
const create = vi.fn();
const verify = vi.fn();
const reconcile = vi.fn();
const listForJob = vi.fn();
const get = vi.fn();
vi.mock("./service", () => ({ createPaymentService: () => ({ create, verify, reconcile }) }));
vi.mock("./store", () => ({ createPaymentStore: () => ({ get, listForJob }) }));
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }) }));

const staff = { id: "00000000-0000-4000-8000-000000000001", email: "test@example.is", displayName: "Staff", role: "dispatcher" as const, operatorId: null };
const jobId = "30000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isDemoMode).mockReturnValue(false);
  vi.mocked(getVerifiedStaffSession).mockResolvedValue(staff);
  vi.mocked(getMyPosConfig).mockReturnValue({ environment: "sandbox", clientId: "m", clientSecret: "s", livePaymentsEnabled: false });
  maybeSingle.mockResolvedValue({ data: { id: jobId, customer_name: "Caller" }, error: null });
  create.mockResolvedValue({ id: "payment" });
});

describe("staff payment action boundary", () => {
  it("refuses all operations before touching credentials or storage without a staff session", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(null);
    const results = await Promise.all([createJobPaymentRequestAction({ jobId, purpose: "initial_fee" }), verifyJobPaymentRequestAction({ paymentId: jobId }), getJobPaymentRequestsAction({ jobId }), reconcilePendingJobPaymentsAction()]);
    expect(results.every((result) => !result.ok && result.errorCode === "staff_access_required")).toBe(true);
    expect(getMyPosConfig).not.toHaveBeenCalled();
    expect(listForJob).not.toHaveBeenCalled();
  });
  it("keeps application demo mode read-only", async () => {
    vi.mocked(isDemoMode).mockReturnValue(true);
    expect(await createJobPaymentRequestAction({ jobId, purpose: "initial_fee" })).toMatchObject({ ok: false, errorCode: "read_only_demo" });
    expect(getMyPosConfig).not.toHaveBeenCalled();
  });
  it("uses only the configured first fee and the authenticated creator", async () => {
    expect((await createJobPaymentRequestAction({ jobId, purpose: "initial_fee" })).ok).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ jobId, amountIsk: 5000, createdBy: staff.id, customerName: "Caller" }));
  });
  it("uses the dispatcher-entered second fee without changing the fixed fee", async () => {
    await createJobPaymentRequestAction({ jobId, purpose: "service", amountIsk: 27000 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amountIsk: 27000, purpose: "service" }));
    expect(getInitialFeeIsk).not.toHaveBeenCalled();
  });
  it.each([{ purpose: "initial_fee", amountIsk: 1 }, { purpose: "service", amountIsk: -1 }, { purpose: "service", amountIsk: 1.5 }, { purpose: "initial_fee", status: "Paid" }])("rejects untrusted payment input", async (extra) => {
    expect(await createJobPaymentRequestAction({ jobId, ...extra })).toMatchObject({ ok: false, errorCode: "payment_invalid_input" });
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects a missing or inaccessible job", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await createJobPaymentRequestAction({ jobId, purpose: "initial_fee" })).toMatchObject({ ok: false, errorCode: "payment_job_unavailable" });
    expect(create).not.toHaveBeenCalled();
  });
  it("never accepts a client-paid assertion in a verification call", async () => {
    expect(await verifyJobPaymentRequestAction({ paymentId: jobId, status: "Paid" })).toMatchObject({ ok: false, errorCode: "payment_invalid_input" });
    expect(verify).not.toHaveBeenCalled();
  });
  it("lets staff read existing history without enabling or authenticating myPOS", async () => {
    listForJob.mockResolvedValueOnce([]);
    expect(await getJobPaymentRequestsAction({ jobId })).toEqual({ ok: true, data: [] });
    expect(getMyPosConfig).not.toHaveBeenCalled();
  });
});
