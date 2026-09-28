import { z } from "zod";

// Matches the Supabase Auth policy: at least 10 characters with letters and digits.
export const staffPasswordSchema = z
  .string()
  .min(10, "Lykilorð þarf að vera minnst 10 stafir.")
  .max(72, "Lykilorð má vera mest 72 stafir.")
  .regex(/\p{L}/u, "Lykilorð þarf að innihalda bókstaf.")
  .regex(/\d/, "Lykilorð þarf að innihalda tölustaf.");

export const staffRoles = ["dispatcher", "admin"] as const;
export type StaffRole = (typeof staffRoles)[number];

export const newStaffUserSchema = z.object({
  displayName: z.string().trim().min(2, "Skráðu nafn.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Skráðu gilt netfang.")),
  password: staffPasswordSchema,
  role: z.enum(staffRoles),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Skráðu núverandi lykilorð."),
    newPassword: staffPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Lykilorðin eru ekki eins.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Nýja lykilorðið þarf að vera annað en það núverandi.",
    path: ["newPassword"],
  });
