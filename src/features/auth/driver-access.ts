import { z } from "zod";

export const driverAccessTokenSchema = z.object({
  tokenHash: z.string().trim().min(20).max(2048),
  type: z.enum(["signup", "magiclink"]),
});
