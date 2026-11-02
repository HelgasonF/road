import { normalizePhoneNumber } from "./phone";

/** A manual draft for one explicit international recipient; never sends SMS. */
export function buildSmsHref(phone: string, message: string, platform: "standard" | "ios" = "standard") {
  const recipient = normalizePhoneNumber(phone);
  if (!recipient) return null;
  const body = message.trim();
  return `sms:${recipient}${body ? `${platform === "ios" ? "&" : "?"}body=${encodeURIComponent(body)}` : ""}`;
}
