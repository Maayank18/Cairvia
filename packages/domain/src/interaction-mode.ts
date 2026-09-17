import type { UserPreferencesV1 } from "@cairvia/schemas";

export type InteractionMode = UserPreferencesV1["interactionMode"];

export function applyInteractionMode(
  prefs: UserPreferencesV1,
  mode: InteractionMode
): UserPreferencesV1 {
  const next: UserPreferencesV1 = {
    ...prefs,
    communication: { ...prefs.communication },
    execution: { ...prefs.execution },
    recovery: { ...prefs.recovery },
    control: { ...prefs.control },
    interactionMode: mode
  };
  if (mode === "CALM") {
    next.communication.conciseResponses = true;
    next.communication.concreteWording = true;
    next.execution.oneActionAtATime = true;
    next.execution.minimizeInterruptions = true;
  }
  if (mode === "DETAILED") {
    next.communication.conciseResponses = false;
    next.communication.explainAmbiguousInstructions = true;
    next.execution.showEffortEstimate = true;
    next.execution.breakDownLargeTasks = true;
  }
  return next;
}
