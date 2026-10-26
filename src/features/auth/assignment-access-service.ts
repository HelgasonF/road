import type { AssignmentAccess } from "./assignment-link";

export interface AssignmentAccessDependencies {
  resolve: () => Promise<AssignmentAccess | null>;
  currentDriver: () => Promise<{ userId: string; operatorId: string } | null>;
  signIn: (userId: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

function sameAccess(left: AssignmentAccess, right: AssignmentAccess | null) {
  return right && left.assignmentId === right.assignmentId && left.jobId === right.jobId
    && left.operatorId === right.operatorId && left.userId === right.userId;
}

export async function openAssignmentAccess(deps: AssignmentAccessDependencies): Promise<
  { ok: true; jobId: string } | { ok: false; reason: "closed" | "unavailable" }
> {
  const access = await deps.resolve();
  if (!access) return { ok: false, reason: "closed" };
  const current = await deps.currentDriver();
  if (current?.userId === access.userId && current.operatorId === access.operatorId) {
    return sameAccess(access, await deps.resolve()) ? { ok: true, jobId: access.jobId } : { ok: false, reason: "closed" };
  }
  if (!(await deps.signIn(access.userId))) return { ok: false, reason: "unavailable" };
  // Closing/reassignment can race with external authentication. A new session
  // must not be retained when the assignment stopped authorizing this link.
  try {
    if (sameAccess(access, await deps.resolve())) return { ok: true, jobId: access.jobId };
  } catch {
    await deps.signOut();
    return { ok: false, reason: "unavailable" };
  }
  await deps.signOut();
  return { ok: false, reason: "closed" };
}
