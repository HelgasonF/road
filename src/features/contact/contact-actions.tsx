import { MessageCircle, PhoneCall } from "lucide-react";

import { buildContactLinks } from "@/lib/contact-links";
import { formatPhoneNumber } from "@/lib/phone";
import { is } from "@/lib/i18n/is";

interface ContactActionsProps {
  personName: string;
  phone: string;
}

export function ContactActions({ personName, phone }: ContactActionsProps) {
  const { callHref, whatsappHref } = buildContactLinks(phone);
  const displayPhone = formatPhoneNumber(phone);

  if (!callHref) return <p className="muted-copy">{displayPhone}</p>;

  return (
    <div className="contact-actions" aria-label={`${is.contact}: ${personName}`}>
      <a
        className="contact-action contact-action-call"
        href={callHref}
        aria-label={`${is.call} í ${personName}: ${displayPhone}`}
      >
        <PhoneCall size={17} />
        <span><small>{is.call}</small><strong>{displayPhone}</strong></span>
      </a>
      {whatsappHref ? (
        <a
          className="contact-action contact-action-whatsapp"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${is.whatsapp}: ${personName}`}
        >
          <MessageCircle size={17} />
          <span><small>{is.whatsapp}</small><strong>{is.openChat}</strong></span>
        </a>
      ) : null}
    </div>
  );
}
