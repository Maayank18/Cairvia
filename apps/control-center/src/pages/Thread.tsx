import { useQuery } from "@tanstack/react-query";
import type { ExecutionEventV1, WorkThreadV1 } from "@cairvia/schemas";
import { api } from "../api";

export function ThreadPage() {
  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => api<{ threads: WorkThreadV1[] }>("/threads")
  });
  const events = useQuery({
    queryKey: ["events"],
    queryFn: () => api<{ events: ExecutionEventV1[] }>("/events")
  });
  const thread = threads.data?.threads[0];

  if (threads.isLoading) {
    return <p>Loading Work Threads…</p>;
  }

  if (!thread) {
    return <p>No Work Thread stored locally.</p>;
  }

  return (
    <div className="timeline">
      <article className="card">
        <h2>{thread.intent}</h2>
        <p>Status: {thread.status}</p>
        <p>Desired outcome: {thread.desiredOutcome}</p>
        <p>Decisions: {thread.decisions.join(" · ") || "None yet"}</p>
        <p>Evidence: {thread.evidenceRefs.join(" · ")}</p>
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
