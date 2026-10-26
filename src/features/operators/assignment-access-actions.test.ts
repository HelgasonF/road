import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDriverAssignmentAccessLinkAction } from "./assignment-access-actions";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { invokeDriverAccessFunction } from "./driver-access-api";
import { hashAssignmentToken } from "@/features/auth/assignment-link";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config", () => ({ isDemoMode: () => false }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedStaffSession: vi.fn() }));
vi.mock("./driver-access-api", () => ({ invokeDriverAccessFunction: vi.fn() }));
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
const input = { jobId: "30000000-0000-4000-8000-000000000001", operatorId: "10000000-0000-4000-8000-000000000001" };
let responses: Record<string, { data: unknown; error: unknown }>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getVerifiedStaffSession).mockResolvedValue({ id: "staff" } as never);
  vi.mocked(invokeDriverAccessFunction).mockResolvedValue({ ok: true, data: {} });
  responses = { job_assignments: { data: { id: "assignment" }, error: null }, jobs: { data: { status: "assigned" }, error: null }, operators: { data: { user_id: "driver", is_active: true, driver_access_disabled_at: null }, error: null } };
  mocks.from.mockImplementation((table: string) => {
    const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => responses[table] };
    return query;
  });
  mocks.rpc.mockResolvedValue({ data: "link-id", error: null });
});
describe("staff assignment link creation", () => {
  it("returns a reusable first-party link and stores only its hash against the chosen assignment", async () => {
    const result = await createDriverAssignmentAccessLinkAction(input);
    expect(result.ok).toBe(true);
    const token = new URL(result.data!.path, "https://example.test").searchParams.get("assignment")!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.rpc).toHaveBeenCalledWith("create_driver_assignment_link", { p_job_id: input.jobId, p_operator_id: input.operatorId, p_token_hash: hashAssignmentToken(token) });
    expect(invokeDriverAccessFunction).not.toHaveBeenCalled();
  });
  it("requires staff before reading or changing anything", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(null);
    expect(await createDriverAssignmentAccessLinkAction(input)).toMatchObject({ ok: false });
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed job/provider identifiers before reading records", async () => {
    expect(await createDriverAssignmentAccessLinkAction({ ...input, jobId: "bad" })).toMatchObject({ ok: false });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not provision an account or issue a credential without an active assignment", async () => {
    responses.job_assignments.data = null;
    expect(await createDriverAssignmentAccessLinkAction(input)).toMatchObject({ ok: false });
    expect(invokeDriverAccessFunction).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["completed", "cancelled"])("does not issue a link for a %s job", async (status) => {
    responses.jobs.data = { status };
    expect(await createDriverAssignmentAccessLinkAction(input)).toMatchObject({ ok: false });
    expect(invokeDriverAccessFunction).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("uses existing staff-authenticated provisioning only when a driver account is missing", async () => {
    responses.operators.data = { user_id: null, is_active: true, driver_access_disabled_at: null };
    expect(await createDriverAssignmentAccessLinkAction(input)).toMatchObject({ ok: true });
    expect(invokeDriverAccessFunction).toHaveBeenCalledWith({ action: "create_link", operatorId: input.operatorId });
  });
  it("does not create a credential after provisioning fails", async () => {
    responses.operators.data = { user_id: null, is_active: true, driver_access_disabled_at: null };
    vi.mocked(invokeDriverAccessFunction).mockResolvedValue({ ok: false, errorCode: "unavailable" });
    expect(await createDriverAssignmentAccessLinkAction(input)).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps storage diagnostics private if the locked state changed before issue", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private SQL details" } });
    const result = await createDriverAssignmentAccessLinkAction(input);
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("private SQL");
  });
});
