import type { PaymentRequest, PaymentStatus } from "./types";

export interface PublicPaymentSummary {
  purpose: "initial_fee" | "service";
  description: string;
  vehicleRegistration: string | null;
  amountIsk: number;
  status: PaymentStatus;
  checkoutUrl: string | null;
  intakeState: "pending" | "submitted" | "review_required" | null;
  retryAllowed?: boolean;
}

export function safeCheckoutUrl(request: PaymentRequest) {
  if (["paid", "expired", "cancelled", "creating", "creation_unknown", "creation_failed"].includes(request.status) || !request.paymentUrl) return null;
  try {
    const url = new URL(request.paymentUrl);
    const hosts = request.environment === "sandbox" ? ["demo.mypos.eu", "demo.mypos.com"] : ["mypos.eu", "www.mypos.eu", "mypos.com", "www.mypos.com"];
    return url.protocol === "https:" && hosts.includes(url.hostname) && !url.username && !url.password && !url.port && !url.hash ? request.paymentUrl : null;
  } catch { return null; }
}
