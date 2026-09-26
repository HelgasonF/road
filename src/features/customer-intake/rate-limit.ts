import "server-only";

import { consumeRateLimit, requestAddress } from "@/lib/rate-limit";

// Generous because Icelandic mobile carriers put many customers behind one
// address; a complete intake with six photos needs roughly 30 requests.
const CUSTOMER_REQUEST_LIMIT = 300;
const CUSTOMER_WINDOW_SECONDS = 10 * 60;

export const customerRateLimitError = "Too many requests. Please wait a few minutes and try again.";

export async function customerLinkRequestAllowed() {
  return consumeRateLimit(`customer:ip:${await requestAddress()}`, CUSTOMER_REQUEST_LIMIT, CUSTOMER_WINDOW_SECONDS);
}
