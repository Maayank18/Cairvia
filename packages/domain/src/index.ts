export { canTransition, transition, IllegalThreadTransitionError } from "./thread-machine.js";
export { isCapsuleStale, isTimestampStale } from "./stale.js";
export {
  TOOL_RISK,
  PHASE1_EXECUTABLE,
  defaultPermissions,
  evaluatePermission,
  assertExecutable
} from "./permissions.js";
export { createRecoveryCapsule, DEFAULT_STALE_AFTER_MINUTES } from "./recovery.js";
export type { ThreadStore } from "./ports.js";
export { ThreadService, ThreadNotFoundError } from "./thread-service.js";
export { MemoryThreadStore } from "./memory-store.js";
