import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAssignmentAccess } from "./assignment-access-service";

const access = { assignmentId: "assignment", jobId: "job", operatorId: "operator", userId: "driver" };
const deps = { resolve: vi.fn(), currentDriver: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks(); deps.resolve.mockResolvedValue(access); deps.currentDriver.mockResolvedValue(null);
  deps.signIn.mockResolvedValue(true); deps.signOut.mockResolvedValue(undefined);
});
describe("reusable driver assignment access", () => {
  it("opens the same assignment repeatedly from separate signed-out browsers", async () => {
    expect(await openAssignmentAccess(deps)).toEqual({ ok: true, jobId: "job" });
    expect(await openAssignmentAccess(deps)).toEqual({ ok: true, jobId: "job" });
    expect(deps.signIn).toHaveBeenCalledTimes(2);
  });
  it("reopens through an existing matching driver session without generating another login", async () => {
    deps.currentDriver.mockResolvedValue({ userId: "driver", operatorId: "operator" });
    expect(await openAssignmentAccess(deps)).toEqual({ ok: true, jobId: "job" });
    expect(deps.signIn).not.toHaveBeenCalled();
  });
  it("does not treat a different provider's session as the assignment's driver", async () => {
    deps.currentDriver.mockResolvedValue({ userId: "other", operatorId: "other" });
    expect(await openAssignmentAccess(deps)).toMatchObject({ ok: true });
    expect(deps.signIn).toHaveBeenCalledWith("driver");
  });
  it("refuses closed/revoked/unassigned links before accessing authentication", async () => {
    deps.resolve.mockResolvedValue(null);
    expect(await openAssignmentAccess(deps)).toEqual({ ok: false, reason: "closed" });
    expect(deps.currentDriver).not.toHaveBeenCalled(); expect(deps.signIn).not.toHaveBeenCalled();
  });
  it("removes a newly created session if completion/reassignment races with authentication", async () => {
    deps.resolve.mockResolvedValueOnce(access).mockResolvedValueOnce(null);
    expect(await openAssignmentAccess(deps)).toEqual({ ok: false, reason: "closed" });
    expect(deps.signOut).toHaveBeenCalledOnce();
  });
  it("does not log out an existing session when its link closes", async () => {
    deps.currentDriver.mockResolvedValue({ userId: "driver", operatorId: "operator" });
    deps.resolve.mockResolvedValueOnce(access).mockResolvedValueOnce(null);
    expect(await openAssignmentAccess(deps)).toEqual({ ok: false, reason: "closed" });
    expect(deps.signOut).not.toHaveBeenCalled();
  });
  it("does not retain a new session if the post-login state check fails", async () => {
    deps.resolve.mockResolvedValueOnce(access).mockRejectedValueOnce(new Error("outage"));
    expect(await openAssignmentAccess(deps)).toEqual({ ok: false, reason: "unavailable" });
    expect(deps.signOut).toHaveBeenCalledOnce();
  });
  it("never opens a workspace after a failed sign-in", async () => {
    deps.signIn.mockResolvedValue(false);
    expect(await openAssignmentAccess(deps)).toEqual({ ok: false, reason: "unavailable" });
  });
});
