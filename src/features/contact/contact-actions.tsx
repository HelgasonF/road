import { MessageCircle, PhoneCall } from "lucide-react";

import { buildContactLinks } from "@/lib/contact-links";
import { is } from "@/lib/i18n/is";

interface ContactActionsProps {
  personName: string;
  phone: string;
}

export function ContactActions({ personName, phone }: ContactActionsProps) {
  const { callHref, whatsappHref } = buildContactLinks(phone);

  if (!callHref) return <p className="muted-copy">{phone}</p>;

  return (
    <div className="contact-actions" aria-label={`${is.contact}: ${personName}`}>
      <a
        className="contact-action contact-action-call"
        href={callHref}
        aria-label={`${is.call} í ${personName}: ${phone}`}
      >
        <PhoneCall size={17} />
        <span><small>{is.call}</small><strong>{phone}</strong></span>
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
