import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, Button } from "@cairvia/ui";
import type { WorkThreadV1 } from "@cairvia/schemas";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";
import { api } from "../api";

export function NowPage() {
  const client = useQueryClient();
  const threadQuery = useQuery({
    queryKey: ["active-thread"],
    queryFn: () => api<{ thread: WorkThreadV1 | null }>("/threads/active")
  });
  const recoveryQuery = useQuery({
    queryKey: ["recovery", threadQuery.data?.thread?.id],
    enabled: Boolean(threadQuery.data?.thread?.id),
    queryFn: () =>
      api<{
        capsule: WorkThreadV1["recoveryCapsule"];
        stale: boolean;
      }>(`/threads/${threadQuery.data!.thread!.id}/recovery`)
  });

  const resume = useMutation({
    mutationFn: async (thread: WorkThreadV1) => {
      await api(`/threads/${thread.id}/resume`, { method: "POST" });
      await api("/actions", {
        method: "POST",
        body: JSON.stringify({
          toolId: "start_focus",
          input: { threadId: thread.id },
          threadId: thread.id
        })
      });
      const request = thread.nextActionRequest;
      if (!request) {
        return;
      }
      if (request.toolId === "copy_to_clipboard") {
        const text = String(request.input.text ?? "");
        if (text && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
        return;
      }
      await api("/actions", {
        method: "POST",
        body: JSON.stringify({
          toolId: request.toolId,
          input: request.input,
          threadId: thread.id
        })
      });
    },
    onSettled: () => client.invalidateQueries()
  });

  const progress = useMutation({
    mutationFn: (id: string) =>
      api(`/threads/${id}/progress`, {
        method: "POST",
        body: JSON.stringify({
          schemaVersion: SCHEMA_VERSIONS.progressNote,
          note: "Marked progress from Control Center",
          done: true
        })
      }),
    onSettled: () => client.invalidateQueries()
  });

  const stop = useMutation({
    mutationFn: async (id: string) => {
      try {
        await api(`/threads/${id}/pause`, { method: "POST" });
      } catch {
        // already paused
      }
      await api(`/threads/${id}/recovery`, { method: "POST" });
    },
    onSettled: () => client.invalidateQueries()
  });

  const thread = threadQuery.data?.thread;
  if (threadQuery.isLoading) {
    return <p>Loading current Work Thread…</p>;
  }
  if (!thread) {
    return <p>No active Work Thread. Seed the local database first.</p>;
  }

  return (
    <article className="card">
      <p>NOW</p>
      <h2>
        {thread.project ?? "Work Thread"} — {thread.intent}
      </h2>
      <p>{thread.desiredOutcome}</p>
      <p>
        <strong>Current state:</strong> {thread.currentState}
      </p>
      <p>
        <strong>Blocker:</strong> {thread.blockers[0] ?? "None"}
      </p>
      <p>
        <strong>Next action:</strong> {thread.nextAction}
        {thread.estimatedEffort ? ` · ${thread.estimatedEffort}` : ""}
      </p>
      {thread.recoveryCapsule ? (
        <Banner>
          {recoveryQuery.data?.stale
            ? `Recovery capsule may be stale (captured ${thread.recoveryCapsule.capturedAt}).`
            : `Resume state saved ${thread.recoveryCapsule.capturedAt}.`}
        </Banner>
      ) : (
        <Banner>No recovery capsule yet. Capture from the Orb or Stop work.</Banner>
      )}
      <div className="row">
        <Button onClick={() => resume.mutate(thread)}>Resume</Button>
        <Button variant="secondary" onClick={() => progress.mutate(thread.id)}>
          Mark progress
        </Button>
        <Button variant="ghost" onClick={() => stop.mutate(thread.id)}>
          Stop work
        </Button>
      </div>
    </article>
  );
}
