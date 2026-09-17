import { SCHEMA_VERSIONS, type WorkThreadV1, defaultUserPreferences } from "@cairvia/schemas";
import {
  interpretCommitment,
  ThreadService,
  type ThreadStore
} from "@cairvia/domain";

export const SEED_THREAD_ID_HINT = "Launch authentication";

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
    intent: "Launch authentication",
    desiredOutcome: "Launch authentication",
    currentState: "OTP registration — health check attempted",
    nextAction: "inspect transporter logs",
    blockers: ["SMTP timeout"],
    decisions: ["OTP registration is the active task"],
    evidenceRefs: ["health check attempted"],
    status: "DRAFT",
    confidence: 0.93,
    estimatedEffort: "~2 min",
    nextActionRequest: {
      schemaVersion: SCHEMA_VERSIONS.actionRequest,
      toolId: "copy_to_clipboard",
      input: {
        text: "Inspect transporter logs for the SMTP timeout"
      }
    }
  });
  const active = await service.resumeThread(draft.id);
  const interrupted = await service.pauseThread(active.id);
  const recovered = await service.captureRecovery(interrupted.id);
  const candidate = interpretCommitment({
    selectedText: "Please send the deployment report by Friday.",
    pageTitle: "Mail",
    pageUrl: "https://mail.example/deployment-report",
    threadId: recovered.id
  });
  candidate.status = "WAITING_FOR_USER";
  await store.saveCommitment(candidate);
  return recovered;
}

export { SEED_THREAD_ID_HINT as seedIntent };
