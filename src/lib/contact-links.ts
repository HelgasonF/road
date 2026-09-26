export interface ContactLinks {
  callHref: string | null;
  whatsappHref: string | null;
}

const ICELAND_COUNTRY_CODE = "354";
const ICELAND_LOCAL_NUMBER_LENGTH = 7;
const E164_MAX_DIGITS = 15;

export function buildContactLinks(phone: string): ContactLinks {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 3) return { callHref: null, whatsappHref: null };

  const startsWithInternationalPrefix = digits.startsWith("00");
  const dialNumber = trimmed.startsWith("+")
    ? `+${digits}`
    : startsWithInternationalPrefix
      ? `+${digits.slice(2)}`
      : digits;

  let whatsappDigits: string | null = null;
  if (trimmed.startsWith("+")) {
    whatsappDigits = digits;
  } else if (startsWithInternationalPrefix) {
    whatsappDigits = digits.slice(2);
  } else if (digits.length === ICELAND_LOCAL_NUMBER_LENGTH) {
    whatsappDigits = `${ICELAND_COUNTRY_CODE}${digits}`;
  } else if (
    digits.length === ICELAND_COUNTRY_CODE.length + ICELAND_LOCAL_NUMBER_LENGTH
    && digits.startsWith(ICELAND_COUNTRY_CODE)
  ) {
    whatsappDigits = digits;
  }
  // Any other number needs an explicit + or 00 prefix; guessing its country
  // code would address the WhatsApp draft to the wrong person.

  if (!whatsappDigits || whatsappDigits.length > E164_MAX_DIGITS) {
    whatsappDigits = null;
  }

  return {
    callHref: `tel:${dialNumber}`,
    whatsappHref: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
  };
}

export function buildWhatsAppHref(phone: string, message: string) {
  const { whatsappHref } = buildContactLinks(phone);
  if (!whatsappHref) return null;

  const normalizedMessage = message.trim();
  return normalizedMessage
    ? `${whatsappHref}?text=${encodeURIComponent(normalizedMessage)}`
    : whatsappHref;
}
