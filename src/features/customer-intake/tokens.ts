import { createHash, randomBytes } from "node:crypto";

const CUSTOMER_TOKEN_BYTES = 32;

export function createCustomerIntakeToken() {
  return randomBytes(CUSTOMER_TOKEN_BYTES).toString("base64url");
}

export function hashCustomerIntakeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
