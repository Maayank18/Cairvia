import { z } from "zod";
import { SCHEMA_VERSIONS } from "./versions.js";

export const AutomationStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING_FOR_USER",
  "SUCCEEDED",
  "FAILED",
  "TIMED_OUT"
]);
export type AutomationStatus = z.infer<typeof AutomationStatusSchema>;

export const AutomationDefinitionV1Schema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.automationDefinition),
  id: z.string().min(1),
  name: z.string().min(1),
  trigger: z.string().min(1),
  condition: z.string(),
  actions: z.array(z.string()),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type AutomationDefinitionV1 = z.infer<typeof AutomationDefinitionV1Schema>;
