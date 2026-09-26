"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";

import { buildWhatsAppHref } from "@/lib/contact-links";

interface ManualMessageProps {
  message: string;
  onOpen?: () => void;
  phone: string;
  recipientName?: string;
}

export function ManualWhatsAppMessage({ message, onOpen, phone, recipientName }: ManualMessageProps) {
  const [copyResult, setCopyResult] = useState<{ message: string; error: boolean } | null>(null);
  const whatsappHref = buildWhatsAppHref(phone, message);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyResult({ message, error: false });
    } catch {
      setCopyResult({ message, error: true });
    }
  }

  return (
    <div className="manual-whatsapp-message">
      <p>Skilaboðin eru tilbúin. Afritaðu þau, límdu í rétt spjall í WhatsApp Business og ýttu sjálf/ur á Senda.</p>
      <div className="manual-whatsapp-actions">
        <button aria-label={recipientName ? `Afrita skilaboð til ${recipientName}` : undefined} className="customer-whatsapp-send" type="button" onClick={copyMessage}>
          {copyResult?.message === message && !copyResult.error ? <Check size={16} /> : <Copy size={16} />}
          Afrita skilaboð
        </button>
        {whatsappHref ? (
          <a aria-label={recipientName ? `Opna WhatsApp fyrir ${recipientName}` : undefined} className="customer-whatsapp-send" href={whatsappHref} onClick={onOpen} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} /> Opna WhatsApp
          </a>
        ) : null}
      </div>
      {copyResult?.message === message ? (
        <p role="status">{copyResult.error ? "Ekki tókst að afrita. Opnaðu skilaboðin hér að neðan og veldu textann handvirkt." : "Skilaboðin voru afrituð. Farðu í WhatsApp Business og límdu þau í rétt spjall."}</p>
      ) : null}
      <details>
        <summary>Skoða tilbúin skilaboð</summary>
        <textarea aria-label="Tilbúin WhatsApp-skilaboð" readOnly rows={6} value={message} onFocus={(event) => event.currentTarget.select()} />
      </details>
      {!whatsappHref ? <p>Ekki tókst að opna símanúmerið í WhatsApp. Athugaðu númerið áður en þú sendir.</p> : null}
    </div>
  );
}
