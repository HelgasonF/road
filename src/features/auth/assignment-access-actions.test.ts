import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDriverAssignmentAccessAction } from "./assignment-access-actions";
import { getVerifiedSession } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hashAssignmentToken } from "./assignment-link";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/config", () => ({ hasSupabaseAdminConfig: () => true, isDemoMode: () => false }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedSession: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn(), requestAddress: async () => "203.0.113.2" }));
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), getUserById: vi.fn(), generateLink: vi.fn(), verifyOtp: vi.fn(), activate: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.resolve, auth: { admin: { getUserById: mocks.getUserById, generateLink: mocks.generateLink } } }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc: mocks.activate, auth: { verifyOtp: mocks.verifyOtp, signOut: mocks.signOut } }) }));

const row = { assignment_id: "a", job_id: "job", operator_id: "operator", driver_user_id: "driver" };
const token = "A".repeat(43);
function form(value = token) { const form = new FormData(); form.set("assignmentToken", value); return form; }
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(consumeRateLimit).mockResolvedValue(true);
  vi.mocked(getVerifiedSession).mockResolvedValue(null);
  mocks.resolve.mockResolvedValue({ data: [row], error: null });
  mocks.getUserById.mockResolvedValue({ data: { user: { id: "driver", email: "driver@example.test" } }, error: null });
  mocks.generateLink.mockResolvedValue({ data: { user: { id: "driver" }, properties: { verification_type: "magiclink", hashed_token: "fresh-otp" } }, error: null });
  mocks.verifyOtp.mockResolvedValue({ data: { user: { id: "driver" }, session: {} }, error: null });
  mocks.activate.mockResolvedValue({ error: null }); mocks.signOut.mockResolvedValue({ error: null });
});

describe("assignment link authentication boundary", () => {
  it("authenticates through a fresh internal OTP and targets the authorized job", async () => {
    const input = form(); input.set("email", "staff@example.test");
    await expect(openDriverAssignmentAccessAction({}, input)).rejects.toThrow("redirect:/driver?job=job");
    expect(mocks.resolve).toHaveBeenCalledWith("resolve_driver_assignment_link", { p_token_hash: hashAssignmentToken(token) });
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "driver@example.test" });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "fresh-otp" });
    expect(mocks.resolve).toHaveBeenCalledTimes(2);
  });
  it("never sends a malformed credential to storage/auth", async () => {
    expect(await openDriverAssignmentAccessAction({}, form("bad"))).toHaveProperty("error");
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.generateLink).not.toHaveBeenCalled();
  });
  it("applies IP/link limits before storage or Auth access", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(false);
    expect(await openDriverAssignmentAccessAction({}, form())).toHaveProperty("error");
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.getUserById).not.toHaveBeenCalled();
    expect(vi.mocked(consumeRateLimit).mock.calls[1][0]).toBe(`driver-assignment:link:${hashAssignmentToken(token)}`);
  });
  it("checks state before reusing an already signed-in provider", async () => {
    mocks.resolve.mockResolvedValue({ data: [], error: null });
    vi.mocked(getVerifiedSession).mockResolvedValue({ id: "driver", role: "driver", operatorId: "operator" } as never);
    expect(await openDriverAssignmentAccessAction({}, form())).toHaveProperty("error");
    expect(getVerifiedSession).not.toHaveBeenCalled(); expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
  it("reuses a valid matching session without creating a new login", async () => {
    vi.mocked(getVerifiedSession).mockResolvedValue({ id: "driver", role: "driver", operatorId: "operator" } as never);
    await expect(openDriverAssignmentAccessAction({}, form())).rejects.toThrow("redirect:/driver?job=job");
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });
  it("rejects mismatched Auth identities before accepting a returned token", async () => {
    mocks.generateLink.mockResolvedValue({ data: { user: { id: "staff" }, properties: { verification_type: "magiclink", hashed_token: "wrong" } }, error: null });
    expect(await openDriverAssignmentAccessAction({}, form())).toHaveProperty("error");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
  it("refuses a banned driver before generating a login", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: { id: "driver", email: "driver@example.test", banned_until: "2999-01-01" } }, error: null });
    expect(await openDriverAssignmentAccessAction({}, form())).toHaveProperty("error");
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });
  it("closes only the newly created session when a job closes during sign-in", async () => {
    mocks.resolve.mockResolvedValueOnce({ data: [row], error: null }).mockResolvedValueOnce({ data: [], error: null });
    expect(await openDriverAssignmentAccessAction({}, form())).toHaveProperty("error");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("cleans up a newly created session if activation fails or throws", async () => {
    mocks.activate.mockRejectedValue(new Error("private database failure"));
    const result = await openDriverAssignmentAccessAction({}, form());
    expect(result).toHaveProperty("error"); expect(JSON.stringify(result)).not.toContain("private database");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
