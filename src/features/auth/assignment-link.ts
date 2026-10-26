import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const assignmentTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export function createAssignmentToken() { return randomBytes(32).toString("base64url"); }
export function hashAssignmentToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function assignmentAccessPath(token: string) { return `/driver/access?assignment=${encodeURIComponent(token)}`; }

export interface AssignmentAccess {
  assignmentId: string;
  jobId: string;
  operatorId: string;
  userId: string;
}
