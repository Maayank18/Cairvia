import { z } from "zod";

export const IpcChannelSchema = z.enum([
  "cairvia:thread:getActive",
  "cairvia:thread:get",
  "cairvia:thread:list",
  "cairvia:thread:update",
  "cairvia:thread:pause",
  "cairvia:thread:resume",
  "cairvia:thread:complete",
  "cairvia:thread:captureRecovery",
  "cairvia:thread:getRecovery",
  "cairvia:thread:markProgress",
  "cairvia:action:execute",
  "cairvia:preferences:get",
  "cairvia:preferences:update",
  "cairvia:permissions:list",
  "cairvia:status:get",
  "cairvia:events:list",
  "cairvia:recovery:card",
  "cairvia:snapshot:idle",
  "cairvia:commitments:pending"
]);
export type IpcChannel = z.infer<typeof IpcChannelSchema>;

export const IPC_CHANNELS = IpcChannelSchema.options;
