import { z } from "zod";

export const VEHICLE_DESTINATION_MAX_LENGTH = 300;

// Missing is retained for old clients/frozen drafts; an explicit blank clears it.
export const destinationLabelSchema = z.string().trim().max(VEHICLE_DESTINATION_MAX_LENGTH)
  .nullable().transform((value) => value || null).optional();
