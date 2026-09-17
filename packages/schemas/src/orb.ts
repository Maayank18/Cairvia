import { z } from "zod";

export const OrbVisualStateSchema = z.enum([
  "IDLE",
  "THINKING",
  "READY",
  "WORKING",
  "WAITING_FOR_APPROVAL",
  "SUCCESS",
  "ERROR",
  "OFFLINE"
]);
export type OrbVisualState = z.infer<typeof OrbVisualStateSchema>;
