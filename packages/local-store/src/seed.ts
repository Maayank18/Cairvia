import { SCHEMA_VERSIONS, type WorkThreadV1, defaultUserPreferences } from "@cairvia/schemas";
import { ThreadService, type ThreadStore } from "@cairvia/domain";

export const SEED_THREAD_ID_HINT = "Fix authentication";

export async function seedIfEmpty(store: ThreadStore): Promise<WorkThreadV1> {
  const existing = await store.listThreads();
  if (existing.length > 0) {
    const active = await store.getActiveThread();
    return active ?? existing[0]!;
  }
  const prefs = defaultUserPreferences();
  await store.savePreferences(prefs);
  const service = new ThreadService(store);
  const draft = await service.createThread({
    project: "CodeArena",
    intent: "Fix authentication",
    desiredOutcome: "OTP registration works end-to-end",
    currentState: "SMTP transport configured; health route created",
    nextAction: "Run mailer health check",
    blockers: ["SMTP connectivity not verified"],
    decisions: ["Use port 587 / STARTTLS"],
    evidenceRefs: ["file:authController.ts", "file:mailer.ts"],
    status: "DRAFT",
    confidence: 0.93,
    estimatedEffort: "~2 min",
    nextActionRequest: {
      schemaVersion: SCHEMA_VERSIONS.actionRequest,
      toolId: "copy_to_clipboard",
      input: {
        text: "curl -s http://127.0.0.1:3000/health/mailer"
      }
    }
  });
  const paused = await service.resumeThread(draft.id);
  return service.pauseThread(paused.id);
}

export { SEED_THREAD_ID_HINT as seedIntent };
