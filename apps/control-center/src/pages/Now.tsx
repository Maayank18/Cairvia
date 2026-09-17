import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, Button, EvidenceBadge } from "@cairvia/ui";
import type { ResumeCardV1, WorkThreadV1 } from "@cairvia/schemas";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";
import { api } from "../api";

export function NowPage() {
  const client = useQueryClient();
  const threadQuery = useQuery({
    queryKey: ["active-thread"],
    queryFn: () => api<{ thread: WorkThreadV1 | null }>("/threads/active")
  });
  const cardQuery = useQuery({
    queryKey: ["resume-card"],
    queryFn: () => api<{ card: ResumeCardV1 }>("/recovery/card")
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
      if (request?.toolId === "copy_to_clipboard") {
        const text = String(request.input.text ?? "");
        if (text && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
      }
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
        /* already paused */
      }
      await api(`/threads/${id}/recovery`, { method: "POST" });
    },
    onSettled: () => client.invalidateQueries()
  });

  const thread = threadQuery.data?.thread;
  const card = cardQuery.data?.card;
  if ((threadQuery.isLoading || cardQuery.isLoading) && (!thread || !card)) {
    return <p>Loading current Work Thread…</p>;
  }
  if ((threadQuery.isError || cardQuery.isError) && thread) {
    return (
      <article className="card">
        <Banner>You're offline. Your last saved context is available.</Banner>
        <h2>{thread.intent}</h2>
        <p>{thread.nextAction}</p>
      </article>
    );
  }
  if (!thread || !card || !card.threadId) {
    return (
      <article className="card">
        <p className="eyebrow">NOW</p>
        <h2>No active thread</h2>
        <p>Start something worth continuing. Cairvia will keep the state you need to return.</p>
      </article>
    );
  }

  const welcome = ["PAUSED", "INTERRUPTED", "RECOVERABLE", "BLOCKED"].includes(
    thread.status
  );

  return (
    <article className="card">
      <p>{welcome ? "WELCOME BACK" : "NOW"}</p>
      <EvidenceBadge label={card.evidenceLabel} />
      <h2>{card.whatIWasDoing}</h2>
      <p>
        <strong>You stopped at:</strong> {card.whereIStopped}
      </p>
      <p>
        <strong>Blocker:</strong> {card.blocker ?? "None stored"}
      </p>
      <p>
        <strong>Next:</strong> {card.nextAction}
        {thread.estimatedEffort ? ` · ${thread.estimatedEffort}` : ""}
      </p>
      {card.lowConfidence ? (
        <Banner>
          {card.lowConfidenceReason ?? "Low confidence — nothing was invented."}
        </Banner>
      ) : card.stale ? (
        <Banner>Recovery state may be stale.</Banner>
      ) : (
        <Banner>Resume state is evidence-based.</Banner>
      )}
      {card.alsoInterrupted[0] ? (
        <p>Also interrupted: {card.alsoInterrupted[0].intent}</p>
      ) : null}
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
