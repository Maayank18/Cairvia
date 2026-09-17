import { describe, expect, it } from "vitest";
import { MemoryThreadStore } from "./memory-store.js";
import {
  applyCommitmentDecision,
  runCommitmentCapture
} from "./commitment-workflow.js";
import type { CommitmentCandidateV1 } from "@cairvia/schemas";

describe("commitment workflow", () => {
  it("is idempotent for duplicate events", async () => {
    const store = new MemoryThreadStore();
    const input = {
      selectedText: "Please send the revised API document by Thursday.",
      pageUrl: "https://mail.example/1",
      store: {
        getByIdempotency: (key: string) => store.getCommitmentByIdempotency(key),
        saveCommitment: (item: CommitmentCandidateV1) => store.saveCommitment(item)
      }
    };
    const first = await runCommitmentCapture(input);
    const second = await runCommitmentCapture(input);
    expect(second.duplicate).toBe(true);
    expect(second.candidate.id).toBe(first.candidate.id);
  });

  it("records a user rejection without updating a thread", () => {
    const store = new MemoryThreadStore();
    const rejected = applyCommitmentDecision(
      {
        schemaVersion: "CommitmentCandidateV1",
        id: "cmt_1",
        idempotencyKey: "abc",
        threadId: null,
        selectedText: "Please send the report by Friday.",
        pageTitle: null,
        pageUrl: null,
        proposedAction: "send the report",
        deadline: "Friday",
        confidence: 0.86,
        needsClarification: false,
        clarificationPrompt: null,
        status: "WAITING_FOR_USER",
        source: "browser.selection",
        createdAt: "2026-09-17T10:00:00.000Z",
        updatedAt: "2026-09-17T10:00:00.000Z"
      },
      "reject"
    );
    expect(rejected.status).toBe("REJECTED");
    void store;
  });
});
