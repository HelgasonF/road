import { z } from "zod";

import {
  billingActions,
  billingPayerTypes,
} from "@/lib/domain/types";

const optionalText = (maxLength: number) => z
  .union([z.string().trim().max(maxLength), z.null()])
  .transform((value) => value || null);

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .transform((value) => value || null)
  .pipe(z.union([z.email(), z.null()]));

const optionalPayerName = z
  .union([z.string().trim().min(2).max(160), z.literal(""), z.null()])
  .transform((value) => value || null);

const optionalAmount = z.union([
  z.number().int().min(0).max(2_147_483_647),
  z.null(),
]);

export const billingDetailsSchema = z.object({
  jobId: z.uuid(),
  payerType: z.union([z.enum(billingPayerTypes), z.null()]),
  payerName: optionalPayerName,
  payerKennitala: optionalText(32),
  payerEmail: optionalEmail,
  payerPhone: optionalText(40),
  payerAddress: optionalText(500),
  authorizationReference: optionalText(120),
  billingReference: optionalText(120),
  serviceSummary: optionalText(4000),
  payerAmountIsk: optionalAmount,
  providerAmountIsk: optionalAmount,
  notes: optionalText(4000),
});

export type BillingDetailsInput = z.input<typeof billingDetailsSchema>;

export const billingTransitionSchema = z.object({
  jobId: z.uuid(),
  action: z.enum(billingActions).exclude(["details_updated"]),
  reference: optionalText(120),
  dueDate: z.union([
    z.iso.date(),
    z.literal("").transform(() => null),
    z.null(),
  ]),
  notes: optionalText(2000),
}).superRefine((value, context) => {
  if (
    (value.action === "issue_payer_invoice" || value.action === "approve_provider_invoice")
    && (!value.reference || !value.dueDate)
  ) {
    context.addIssue({
      code: "custom",
      message: "Reikningsnúmer og gjalddagi eru nauðsynleg.",
      path: [!value.reference ? "reference" : "dueDate"],
    });
  }

  if (
    (value.action === "dispute_payer" || value.action === "dispute_provider")
    && !value.notes
  ) {
    context.addIssue({
      code: "custom",
      message: "Skrá þarf ástæðu ágreinings.",
      path: ["notes"],
    });
  }
});

export type BillingTransitionInput = z.input<typeof billingTransitionSchema>;
