import { z } from "zod";

export const customerTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const optionalText = (maximum: number) => z.string().trim().max(maximum)
  .transform((value) => value || null);

const phoneSchema = z.string().trim().min(3).max(40).refine(
  (value) => value.replace(/\D/g, "").length >= 3,
  "Enter a valid telephone number.",
);

export const customerIntakeSchema = z.object({
  token: customerTokenSchema,
  customerName: z.string().trim().min(2).max(120),
  customerPhone: phoneSchema,
  vehicleRegistration: optionalText(24).transform((value) => value?.toLocaleUpperCase("is") ?? null),
  vehicleMake: optionalText(120),
  vehicleModel: optionalText(120),
  vehicleType: optionalText(120),
  latitude: z.number().min(62.5).max(67.5),
  longitude: z.number().min(-25.5).max(-12),
  locationLabel: z.string().trim().min(2).max(300),
  locationSource: z.enum(["gps", "map_pin"]),
  customerNotes: z.string().trim().min(5).max(4000),
});

export const customerLinkCreationSchema = z.object({
  jobId: z.uuid(),
});

export const customerLinkRevocationSchema = z.object({
  linkId: z.uuid(),
});

export const supportedCustomerPhotoTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const CUSTOMER_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const CUSTOMER_PHOTO_LIMIT = 6;

export const customerPhotoPreparationSchema = z.object({
  token: customerTokenSchema,
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(supportedCustomerPhotoTypes),
  sizeBytes: z.number().int().positive().max(CUSTOMER_PHOTO_MAX_BYTES),
});

export const customerPhotoMutationSchema = z.object({
  token: customerTokenSchema,
  photoId: z.uuid(),
});
