import { describe, expect, it } from "vitest";
import { assignmentAccessPath, assignmentTokenSchema, createAssignmentToken, hashAssignmentToken } from "./assignment-link";
import { initialDriverJobId } from "@/features/driver/workflow";

describe("assignment credentials and driver landing", () => {
  it("creates independent unguessable tokens and stores a hash rather than the credential", () => {
    const token = createAssignmentToken();
    expect(assignmentTokenSchema.safeParse(token).success).toBe(true);
    expect(createAssignmentToken()).not.toBe(token);
    expect(hashAssignmentToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAssignmentToken(token)).toBe(hashAssignmentToken(token));
    expect(assignmentAccessPath(token)).toBe(`/driver/access?assignment=${token}`);
  });
  it.each(["", "a".repeat(42), "a".repeat(44), "../private", "<script>"])("rejects malformed tokens: %s", (value) => {
    expect(assignmentTokenSchema.safeParse(value).success).toBe(false);
  });
  it("selects the linked authorized job, with an existing fallback for unknown jobs", () => {
    const jobs = [{ id: "first", status: "assigned" }, { id: "linked", status: "working" }];
    expect(initialDriverJobId(jobs, "linked")).toBe("linked");
    expect(initialDriverJobId(jobs, "other-provider-job")).toBe("first");
    expect(initialDriverJobId(jobs, ["linked"])).toBe("first");
    expect(initialDriverJobId([], "linked")).toBeNull();
  });
});
