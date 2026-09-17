import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Banner, Button } from "@cairvia/ui";
import type { CommitmentCandidateV1 } from "@cairvia/schemas";
import { api } from "../api";

type AutomationsResponse = {
  automations: Array<{
    name: string;
    trigger: string;
    steps: string[];
    runs: CommitmentCandidateV1[];
  }>;
};

export function AutomationsPage() {
  const client = useQueryClient();
  const [deadline, setDeadline] = useState("");
  const query = useQuery({
    queryKey: ["automations"],
    queryFn: () => api<AutomationsResponse>("/automations")
  });

  const decide = useMutation({
    mutationFn: (input: {
      id: string;
      decision: "add" | "reject";
      deadline?: string;
    }) =>
      api(`/commitments/${input.id}/decide`, {
        method: "POST",
        body: JSON.stringify({
          decision: input.decision,
          deadline: input.deadline
        })
      }),
    onSettled: () => client.invalidateQueries()
  });

  const workflow = query.data?.automations[0];
  const pending =
    workflow?.runs.filter((run) => run.status === "WAITING_FOR_USER") ?? [];

  return (
    <div className="timeline">
      <article className="card">
        <h2>Commitment Capture</h2>
        <p>
          Browser-selected text → extract → validate → you confirm → Work Thread
          updates. Local stand-in for EventBridge + Step Functions.
        </p>
        <p>{workflow?.steps.join(" → ")}</p>
      </article>
      {pending.length === 0 ? (
        <article className="card">
          <Banner>
            No pending commitments. Select text in the browser companion and send
            it to Cairvia.
          </Banner>
        </article>
      ) : (
        pending.map((run) => (
          <article className="card" key={run.id}>
            <p>Candidate commitment</p>
            <h2>{run.proposedAction}</h2>
            <p>Deadline: {run.deadline ?? "not stated"}</p>
            <p>Confidence: {run.confidence.toFixed(2)}</p>
            {run.needsClarification ? (
              <>
                <Banner>{run.clarificationPrompt ?? "Needs clarification."}</Banner>
                <label className="pref">
                  Deadline
                  <input
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="Friday"
                  />
                </label>
              </>
            ) : null}
            <div className="row">
              <Button
                disabled={run.needsClarification && !deadline.trim()}
                onClick={() =>
                  decide.mutate({
                    id: run.id,
                    decision: "add",
                    deadline: deadline.trim() || undefined
                  })
                }
              >
                Add
              </Button>
              <Button
                variant="ghost"
                onClick={() => decide.mutate({ id: run.id, decision: "reject" })}
              >
                Ignore
              </Button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
