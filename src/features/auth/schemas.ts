import { z } from "zod";

export const passwordSetupSchema = z.object({
  password: z.string()
    .min(10)
    .max(128)
    .regex(/[A-Za-zÁÉÍÓÚÝÞÆÖáðéíóúýþæö]/, "Password must include a letter.")
    .regex(/[0-9]/, "Password must include a number."),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords must match.",
  path: ["confirmPassword"],
});
