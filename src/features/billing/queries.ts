import "server-only";

import type { Job } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import type { JobBillingCase, JobBillingEvent, JobBillingRecord } from "./types";

type BillingRow = {
  job_id: string;
  payer_type: JobBillingRecord["payerType"];
  payer_name: string | null;
  payer_kennitala: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  payer_address: string | null;
  authorization_reference: string | null;
  billing_reference: string | null;
  service_summary: string | null;
  payer_amount_isk: number | null;
  provider_amount_isk: number | null;
  receivable_status: JobBillingRecord["receivableStatus"];
  payer_invoice_number: string | null;
  payer_invoice_issued_at: string | null;
  payer_due_at: string | null;
  payer_paid_at: string | null;
  payable_status: JobBillingRecord["payableStatus"];
  provider_invoice_number: string | null;
  provider_invoice_received_at: string | null;
  provider_due_at: string | null;
  provider_paid_at: string | null;
  notes: string | null;
  updated_at: string;
};

type BillingEventRow = {
  id: number;
  job_id: string;
  action: JobBillingEvent["action"];
  reference: string | null;
  due_at: string | null;
  notes: string | null;
  changed_at: string;
  profiles: { display_name: string } | null;
};

export async function getJobBillingRecords(): Promise<JobBillingRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_billing")
    .select(`
      job_id,
      payer_type,
      payer_name,
      payer_kennitala,
      payer_email,
      payer_phone,
      payer_address,
      authorization_reference,
      billing_reference,
      service_summary,
      payer_amount_isk,
      provider_amount_isk,
      receivable_status,
      payer_invoice_number,
      payer_invoice_issued_at,
      payer_due_at,
      payer_paid_at,
      payable_status,
      provider_invoice_number,
      provider_invoice_received_at,
      provider_due_at,
      provider_paid_at,
      notes,
      updated_at
    `)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Unable to load billing records: ${error.message}`);

  return (data as unknown as BillingRow[]).map((row) => ({
    jobId: row.job_id,
    payerType: row.payer_type,
    payerName: row.payer_name,
    payerKennitala: row.payer_kennitala,
    payerEmail: row.payer_email,
    payerPhone: row.payer_phone,
    payerAddress: row.payer_address,
    authorizationReference: row.authorization_reference,
    billingReference: row.billing_reference,
    serviceSummary: row.service_summary,
    payerAmountIsk: row.payer_amount_isk,
    providerAmountIsk: row.provider_amount_isk,
    receivableStatus: row.receivable_status,
    payerInvoiceNumber: row.payer_invoice_number,
    payerInvoiceIssuedAt: row.payer_invoice_issued_at,
    payerDueAt: row.payer_due_at,
    payerPaidAt: row.payer_paid_at,
    payableStatus: row.payable_status,
    providerInvoiceNumber: row.provider_invoice_number,
    providerInvoiceReceivedAt: row.provider_invoice_received_at,
    providerDueAt: row.provider_due_at,
    providerPaidAt: row.provider_paid_at,
    notes: row.notes,
    updatedAt: row.updated_at,
  }));
}

export async function getJobBillingEvents(): Promise<JobBillingEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_billing_events")
    .select("id, job_id, action, reference, due_at, notes, changed_at, profiles!job_billing_events_changed_by_fkey(display_name)")
    .order("changed_at", { ascending: false });

  if (error) throw new Error(`Unable to load billing events: ${error.message}`);

  return (data as unknown as BillingEventRow[]).map((row) => ({
    id: row.id,
    jobId: row.job_id,
    action: row.action,
    reference: row.reference,
    dueAt: row.due_at,
    notes: row.notes,
    changedByName: row.profiles?.display_name ?? "Óþekktur notandi",
    changedAt: row.changed_at,
  }));
}

export function buildJobBillingCases(jobs: Job[], records: JobBillingRecord[]): JobBillingCase[] {
  const recordsByJob = new Map(records.map((record) => [record.jobId, record]));

  return jobs.flatMap((job) => {
    const record = recordsByJob.get(job.id);
    if (!record) return [];
    return [{
      ...record,
      customerName: job.customerName,
      customerPhone: job.customerPhone,
      locationLabel: job.locationLabel,
      jobStatus: job.status,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      operatorName: job.assignment?.operatorName ?? null,
    }];
  });
}
