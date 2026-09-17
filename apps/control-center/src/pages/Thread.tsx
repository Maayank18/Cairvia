import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@cairvia/ui";
import type { ExecutionEventV1, WorkThreadV1 } from "@cairvia/schemas";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";
import { api } from "../api";

export function ThreadPage() {
  const client = useQueryClient();
  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => api<{ threads: WorkThreadV1[] }>("/threads")
  });
  const events = useQuery({
    queryKey: ["events"],
    queryFn: () => api<{ events: ExecutionEventV1[] }>("/events")
  });
  const thread = threads.data?.threads[0];
  const [currentState, setCurrentState] = useState("");
  const [nextAction, setNextAction] = useState("");

  const save = useMutation({
    mutationFn: (target: WorkThreadV1) =>
      api(`/threads/${target.id}`, {
        method: "PUT",
        headers: { "X-Cairvia-Source": "WEB" },
        body: JSON.stringify({
          schemaVersion: SCHEMA_VERSIONS.threadUpdate,
          currentState: currentState || target.currentState,
          nextAction: nextAction || target.nextAction,
          expectedVersion: target.version
        })
      }),
    onSettled: () => client.invalidateQueries()
  });

  if (threads.isLoading && !thread) {
    return <p>Loading Work Threads…</p>;
  }

  if (threads.isError && thread) {
    return (
      <article className="card">
        <h2>{thread.intent}</h2>
        <p>You're offline. Your last saved context is available.</p>
      </article>
    );
  }

  if (!thread) {
    return <p>No Work Thread stored locally. Start something worth continuing.</p>;
  }

  return (
    <div className="timeline">
      <article className="card">
        <h2>{thread.project ?? thread.intent}</h2>
        <p>Status: {thread.status}</p>
        <p>
          <strong>Goal:</strong> {thread.desiredOutcome}
        </p>
        <p>
          <strong>Current task:</strong> {thread.currentState}
        </p>
        <p>
          <strong>Blocker:</strong> {thread.blockers[0] ?? "None stored"}
        </p>
        <p>
          <strong>Next action:</strong> {thread.nextAction}
        </p>
        <p>Decisions: {thread.decisions.join(" · ") || "None yet"}</p>
        <p>Evidence: {thread.evidenceRefs.join(" · ")}</p>
        <label>
          Update current state
          <input
            value={currentState}
            onChange={(event) => setCurrentState(event.target.value)}
            placeholder={thread.currentState}
          />
        </label>
        <label>
          Update next action
          <input
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder={thread.nextAction}
          />
        </label>
        <Button onClick={() => save.mutate(thread)}>Save to Work Thread</Button>
        {save.isError ? <p>Could not save. Reload if another surface updated first.</p> : null}
      </article>
      <article className="card">
        <h2>Timeline</h2>
        {(events.data?.events ?? []).map((event) => (
          <p key={event.id}>
            {new Date(event.createdAt).toLocaleString()} — {event.type}
          </p>
        ))}
      </article>
    </div>
  );
}
