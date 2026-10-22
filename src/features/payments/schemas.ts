import { z } from "zod";

export const paymentAmountSchema = z.number().int().positive().max(2_147_483_647);
const paymentOptions = {
  // The caller supplies the existing language choice, or lets myPOS use its
  // account default. No customer copy or preferred language is imposed here.
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  expiryDate: z.iso.date().optional(),
};

export const createPaymentSchema = z.discriminatedUnion("purpose", [
  z.object({ jobId: z.uuid(), purpose: z.literal("initial_fee"), ...paymentOptions }).strict(),
  z.object({ jobId: z.uuid(), purpose: z.literal("service"), amountIsk: paymentAmountSchema, ...paymentOptions }).strict(),
]);

export const verifyPaymentSchema = z.object({ paymentId: z.uuid() }).strict();
export const paymentJobSchema = z.object({ jobId: z.uuid() }).strict();
