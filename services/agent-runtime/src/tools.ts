import type { AppKernel } from "@cairvia/api";
import {
  planNextAction,
  runCommitmentCapture
} from "@cairvia/domain";
import { evaluateCedar } from "@cairvia/policy";

export type BoundedToolName =
  | "get_active_thread"
  | "get_recent_snapshots"
  | "get_confirmed_context"
  | "propose_next_action"
  | "create_candidate_commitment";

export async function runBoundedTool(
  kernel: AppKernel,
  name: BoundedToolName,
  input: Record<string, unknown> = {}
): Promise<unknown> {
  if (name === "get_active_thread" || name === "get_recent_snapshots" || name === "get_confirmed_context") {
    const auth = evaluateCedar({ action: "READ_CONTEXT" });
    if (auth.decision === "forbid") {
      return { error: "READ_CONTEXT forbidden", reasons: auth.reasons };
    }
  }
  if (name === "create_candidate_commitment") {
    const auth = evaluateCedar({ action: "CREATE_TASK", userApproved: false });
    if (auth.decision === "forbid") {
      const text = String(input.selectedText ?? "");
      const { candidate } = await runCommitmentCapture({
        selectedText: text,
        pageTitle: input.pageTitle as string | undefined,
        pageUrl: input.pageUrl as string | undefined,
        threadId: (input.threadId as string | undefined) ?? null,
        store: {
          getByIdempotency: (key) => kernel.store.getCommitmentByIdempotency(key),
          saveCommitment: (item) => kernel.store.saveCommitment(item)
        }
      });
      return {
        candidate,
        authorization: auth,
        note: "Candidate stored. CREATE_TASK remains waiting for user approval."
      };
    }
  }

  switch (name) {
    case "get_active_thread":
      return kernel.threads.getActiveThread();
    case "get_recent_snapshots": {
      const threadId = input.threadId as string | undefined;
      const snapshots = await kernel.store.listSnapshots(threadId);
      return snapshots.slice(0, 5);
    }
    case "get_confirmed_context": {
      const items = await kernel.store.listContextItems(
        input.threadId as string | undefined
      );
      return items.filter((item) => item.userConfirmed || item.lifecycle === "CONFIRMED");
    }
    case "propose_next_action": {
      const thread = await kernel.threads.getActiveThread();
      return planNextAction(thread);
    }
    case "create_candidate_commitment":
      return { error: "unreachable" };
    default:
      return { error: "unknown tool" };
  }
}

export async function invokeDeterministicAgent(
  kernel: AppKernel,
  utterance: string
): Promise<{
  nextAction: string;
  rationale: string;
  toolCalls: BoundedToolName[];
}> {
  const toolCalls: BoundedToolName[] = ["get_active_thread", "propose_next_action"];
  const thread = (await runBoundedTool(kernel, "get_active_thread")) as Awaited<
    ReturnType<AppKernel["threads"]["getActiveThread"]>
  >;
  const planned = planNextAction(thread);
  const lower = utterance.toLowerCase();
  const rationale =
    lower.includes("first") || lower.includes("what should")
      ? thread?.blockers[0]
        ? `Fix the blocker first: ${thread.blockers[0]}. Next: ${planned.nextAction}`
        : planned.whyNow
      : planned.whyNow;
  return {
    nextAction: planned.nextAction,
    rationale,
    toolCalls
  };
}
