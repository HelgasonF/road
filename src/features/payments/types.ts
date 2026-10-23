export type PaymentPurpose = "initial_fee" | "service";
export type PaymentEnvironment = "sandbox" | "production";
export type VerifiedPaymentStatus = "pending" | "seen" | "paid" | "failed" | "expired" | "cancelled" | "unknown";
export type PaymentStatus = "creating" | "creation_unknown" | "creation_failed" | VerifiedPaymentStatus;

export interface PaymentAccount {
  environment: PaymentEnvironment;
  merchantId: string;
  providerApi: string;
}

export interface PaymentRequest {
  id: string;
  jobId: string;
  purpose: PaymentPurpose;
  environment: PaymentEnvironment;
  merchantId: string;
  providerApi: string;
  amountIsk: number;
  currency: "ISK";
  reference: string;
  providerCode: string | null;
  paymentUrl: string | null;
  status: PaymentStatus;
  providerStatus: string | null;
  createdAt: string;
  lastVerifiedAt: string | null;
  paidAt: string | null;
  errorCode: string | null;
}

export type PaymentRow = {
  id: string;
  job_id: string;
  purpose: PaymentPurpose;
  provider: "mypos";
  environment: PaymentEnvironment;
  merchant_id: string;
  provider_api: string;
  amount_isk: number;
  currency: "ISK";
  reference: string;
  provider_code: string | null;
  payment_url: string | null;
  status: PaymentStatus;
  provider_status: string | null;
  error_code: string | null;
  created_by: string;
  created_at: string;
  last_verified_at: string | null;
  paid_at: string | null;
};

export interface ProviderPaymentInput {
  amountIsk: number;
  reference: string;
  customerName?: string;
  language?: string;
  expiryDate?: string;
}

export interface ProviderPaymentDetails {
  code: string;
  amountIsk: number;
  currency: "ISK";
  reference: string;
  status: VerifiedPaymentStatus;
  providerStatus: string;
}

export interface PaymentProvider {
  readonly account: PaymentAccount;
  /** Check requirements before reserving a slot or sending a creation POST. */
  prepare(input: Omit<ProviderPaymentInput, "reference">): Promise<void>;
  create(input: ProviderPaymentInput): Promise<{ code: string; url: string }>;
  get(code: string): Promise<ProviderPaymentDetails>;
}

export type PaymentResult<T> = { ok: true; data: T } | { ok: false; error: string; errorCode: string; fieldErrors?: Record<string, string[]> };
