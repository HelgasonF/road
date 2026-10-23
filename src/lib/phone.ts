import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

// Older stored numbers often omit +354. This fallback is for legacy parsing,
// never the initial selection of a new phone field.
export const LEGACY_PHONE_COUNTRY: CountryCode = "IS";

export function parsePhoneNumber(value: string, country = LEGACY_PHONE_COUNTRY) {
  return parsePhoneNumberFromString(value.trim(), { defaultCountry: country, extract: false });
}

// Length-valid legacy numbers can still be formatted/normalized even if their
// allocation is absent from current metadata. Never guess an overseas prefix.
export function normalizePhoneNumber(value: string, country = LEGACY_PHONE_COUNTRY): string | null {
  const phone = parsePhoneNumber(value, country);
  return phone?.isPossible() && !phone.ext ? phone.number : null;
}

export function normalizePhoneNumberOrOriginal(value: string) {
  return normalizePhoneNumber(value) ?? value.trim();
}

export function isValidPhoneNumber(value: string, country = LEGACY_PHONE_COUNTRY) {
  const phone = parsePhoneNumber(value, country);
  return Boolean(phone?.isValid() && !phone.ext);
}

export function formatPhoneNumber(value: string | null | undefined) {
  if (!value) return "";
  const phone = parsePhoneNumber(value);
  if (!phone?.isPossible() || phone.ext) return value.trim();
  // WhatsApp-style NANP formatting; other countries keep their own grouping.
  return phone.countryCallingCode === "1"
    ? `+1 ${phone.formatNational()}`
    : phone.formatInternational();
}

export function formatContactName(name: string, phone: string) {
  return name === phone ? formatPhoneNumber(phone) : name;
}
