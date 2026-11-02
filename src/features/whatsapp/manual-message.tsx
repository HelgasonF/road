"use client";

import { Check, Copy, MessageCircle, MessageSquareText } from "lucide-react";
import { useState, type MouseEvent } from "react";

import { buildWhatsAppHref } from "@/lib/contact-links";
import { formatContactName } from "@/lib/phone";
import { buildSmsHref } from "@/lib/sms-links";

interface ManualMessageProps {
  allowSms?: boolean;
  message: string;
  onOpen?: () => void;
  phone: string;
  recipientName?: string;
}

export function ManualWhatsAppMessage({ allowSms = false, message, onOpen, phone, recipientName }: ManualMessageProps) {
  const [copyResult, setCopyResult] = useState<{ message: string; error: boolean } | null>(null);
  const whatsappHref = buildWhatsAppHref(phone, message);
  const smsHref = allowSms ? buildSmsHref(phone, message) : null;
  const recipientLabel = recipientName ? formatContactName(recipientName, phone) : undefined;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyResult({ message, error: false });
    } catch {
      setCopyResult({ message, error: true });
    }
  }

  function prepareSms(event: MouseEvent<HTMLAnchorElement>) {
    // Detect the platform only during the user gesture, keeping SSR/hydration
    // deterministic. iPadOS may use a desktop Mac user agent.
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    const href = buildSmsHref(phone, message, ios ? "ios" : "standard");
    if (href) event.currentTarget.href = href;
  }

  return (
    <div className="manual-whatsapp-message">
      <p>{allowSms ? "Skilaboðin eru tilbúin. Opnaðu WhatsApp eða SMS, eða afritaðu skilaboðin. Ýttu sjálf/ur á Senda í skilaboðaforritinu." : "Skilaboðin eru tilbúin. Opnaðu WhatsApp eða afritaðu þau og límdu í spjallið við viðtakandann. Ýttu sjálf/ur á Senda."}</p>
      <div className="manual-whatsapp-actions">
        <button aria-label={recipientLabel ? `Afrita skilaboð til ${recipientLabel}` : undefined} className="customer-whatsapp-send" type="button" onClick={copyMessage}>
          {copyResult?.message === message && !copyResult.error ? <Check size={16} /> : <Copy size={16} />}
          Afrita skilaboð
        </button>
        {whatsappHref ? (
          <a aria-label={recipientLabel ? `Opna WhatsApp fyrir ${recipientLabel}` : undefined} className="customer-whatsapp-send" href={whatsappHref} onClick={onOpen} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} /> Opna WhatsApp
          </a>
        ) : null}
        {smsHref ? (
          <a aria-label={recipientLabel ? `Opna SMS fyrir ${recipientLabel}` : undefined} className="customer-whatsapp-send" href={smsHref} onClick={prepareSms}>
            <MessageSquareText size={16} /> Opna SMS
          </a>
        ) : null}
      </div>
      {allowSms ? <p className="manual-sms-help">SMS opnast í skilaboðaforriti tækisins og notar sendinúmerið sem er valið þar. Ef það opnast ekki skaltu afrita skilaboðin og senda þau úr símanum. SMS og WhatsApp nota sama tengil.</p> : null}
      {copyResult?.message === message ? (
        <p role="status">{copyResult.error ? "Ekki tókst að afrita. Opnaðu skilaboðin hér að neðan og veldu textann handvirkt." : allowSms ? "Skilaboðin voru afrituð. Límdu þau í WhatsApp eða SMS til viðtakandans." : "Skilaboðin voru afrituð. Farðu í WhatsApp og límdu þau í spjallið við viðtakandann."}</p>
      ) : null}
      <details>
        <summary>Skoða tilbúin skilaboð</summary>
        <textarea aria-label={allowSms ? "Tilbúin skilaboð" : "Tilbúin WhatsApp-skilaboð"} readOnly rows={6} value={message} onFocus={(event) => event.currentTarget.select()} />
      </details>
      {!whatsappHref ? <p>Ekki tókst að opna símanúmerið í WhatsApp. Athugaðu númerið áður en þú sendir.</p> : null}
      {allowSms && !smsHref && whatsappHref ? <p>Ekki tókst að undirbúa SMS fyrir símanúmerið. Athugaðu númerið áður en þú sendir.</p> : null}
    </div>
  );
}
