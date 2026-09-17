import type { Handler } from "aws-lambda";
import { runCommitmentCapture } from "@cairvia/domain";
import { evaluateCedar } from "@cairvia/policy";
import { kernelForUser, saveTaskToken } from "../lib/kernel.js";
import { observe } from "../lib/observe.js";
import { decideCommitment } from "@cairvia/api";

export const extractHandler: Handler = async (event) => {
  const userId = String(event.userId ?? "demo");
  const auth = evaluateCedar({ action: "READ_CONTEXT" });
  observe({
    requestId: event.requestId,
    threadId: event.threadId,
    authorization: auth.decision,
    toolCalls: ["extract_candidate_commitment"]
  });
  if (auth.decision === "forbid") {
    throw new Error("READ_CONTEXT forbidden");
  }
  const kernel = kernelForUser(userId);
  const { candidate } = await runCommitmentCapture({
    selectedText: String(event.selectedText ?? ""),
    pageTitle: event.pageTitle,
    pageUrl: event.pageUrl,
    threadId: event.threadId ?? null,
    store: {
      getByIdempotency: (key) => kernel.store.getCommitmentByIdempotency(key),
      saveCommitment: (item) => kernel.store.saveCommitment(item)
    }
  });
  return {
    ...event,
    candidate,
    valid: !candidate.needsClarification && candidate.status !== "FAILED",
    commitmentId: candidate.id
  };
};

export const recordTokenHandler: Handler = async (event) => {
  await saveTaskToken(
    String(event.userId ?? "demo"),
    String(event.commitmentId),
    String(event.token)
  );
  observe({
    threadId: event.threadId,
    result: "waiting_for_user_decision"
  });
  return { waiting: true };
};

export const applyHandler: Handler = async (event) => {
  const userId = String(event.userId ?? "demo");
  const approved = Boolean(event.approved);
  const auth = evaluateCedar({
    action: "CREATE_TASK",
    userApproved: approved
  });
  observe({
    threadId: event.threadId,
    authorization: auth.decision,
    userApproval: approved,
    toolCalls: ["create_candidate_commitment"]
  });
  if (auth.decision === "forbid" || !approved) {
    return { skipped: true, reason: auth.reasons };
  }
  const kernel = kernelForUser(userId);
  return decideCommitment(kernel, String(event.commitmentId), "add");
};
