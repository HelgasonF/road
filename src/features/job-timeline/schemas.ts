import { z } from "zod";

import { jobContactChannels, jobContactPurposes } from "@/lib/domain/types";

export const jobContactEventSchema = z.object({
  jobId: z.uuid(),
  operatorId: z.uuid(),
  channel: z.enum(jobContactChannels),
  purpose: z.enum(jobContactPurposes),
});
