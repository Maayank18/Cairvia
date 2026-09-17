import { useEffect, useMemo, useState } from "react";
import { Banner, Button, StatusDot } from "@cairvia/ui";
import type { OrbVisualState, WorkThreadV1 } from "@cairvia/schemas";
import { SCHEMA_VERSIONS } from "@cairvia/schemas";

const STATE_COLOR: Record<OrbVisualState, string> = {
  IDLE: "#b7aa98",
  THINKING: "#c4a574",
  READY: "#7eb8a2",
  WORKING: "#6ea8ff",
  WAITING_FOR_APPROVAL: "#e0b15a",
  SUCCESS: "#8fce7a",
  ERROR: "#e07a6a",
  OFFLINE: "#8a8378"
};

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [thread, setThread] = useState<WorkThreadV1 | null>(null);
  const [state, setState] = useState<OrbVisualState>("IDLE");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [message, setMessage] = useState<string | null>(null);

  const visual: OrbVisualState = offline ? "OFFLINE" : state;

  async function loadThread(): Promise<WorkThreadV1 | null> {
    const next = (await window.cairvia.invoke(
      "cairvia:thread:getActive"
    )) as WorkThreadV1 | null;
    setThread(next);
    if (next) {
      setState("READY");
    }
    return next;
  }

  useEffect(() => {
    void loadThread();
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return window.cairvia.onLayout(setExpanded);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--orb-color", STATE_COLOR[visual]);
  }, [visual]);

  const alreadyTried = useMemo(
    () => thread?.evidenceRefs.slice(0, 4) ?? [],
    [thread]
  );

  function togglePanel() {
    const next = !expanded;
    setExpanded(next);
    setMenuOpen(false);
    window.cairvia.expand(next);
  }

  function openMenu(event: React.MouseEvent) {
    event.preventDefault();
    setMenuOpen(true);
    setExpanded(true);
    window.cairvia.expand(true);
  }

  async function run(label: string, work: () => Promise<void>) {
    try {
      setState("WORKING");
      setMessage(null);
      await work();
      setState("SUCCESS");
    } catch (error) {
      setState("ERROR");
      setMessage(error instanceof Error ? error.message : label);
    }
  }

  async function resume() {
    if (!thread) {
      return;
    }
    await run("resume", async () => {
      const updated = (await window.cairvia.invoke("cairvia:thread:resume", {
        id: thread.id
      })) as WorkThreadV1;
      setThread(updated);
      await window.cairvia.invoke("cairvia:action:execute", {
        toolId: "start_focus",
        threadId: thread.id,
        input: { threadId: thread.id }
      });
      if (updated.nextActionRequest) {
        await window.cairvia.invoke("cairvia:action:execute", {
          toolId: updated.nextActionRequest.toolId,
          threadId: thread.id,
          input: updated.nextActionRequest.input
        });
      }
    });
  }

  async function capture() {
    if (!thread) {
      return;
    }
    await run("capture", async () => {
      const updated = (await window.cairvia.invoke(
        "cairvia:thread:captureRecovery",
        { id: thread.id }
      )) as WorkThreadV1;
      setThread(updated);
    });
  }

  async function stopWork() {
    if (!thread) {
      return;
    }
    await run("pause", async () => {
      if (thread.status === "ACTIVE") {
        await window.cairvia.invoke("cairvia:thread:pause", { id: thread.id });
      }
      const updated = (await window.cairvia.invoke(
        "cairvia:thread:captureRecovery",
        { id: thread.id }
      )) as WorkThreadV1;
      setThread(updated);
    });
  }

  async function markProgress() {
    if (!thread) {
      return;
    }
    await run("progress", async () => {
      const updated = (await window.cairvia.invoke(
        "cairvia:thread:markProgress",
        {
          id: thread.id,
          note: {
            schemaVersion: SCHEMA_VERSIONS.progressNote,
            note: "Health check command copied; waiting on SMTP response",
            done: true
          }
        }
      )) as WorkThreadV1;
      setThread(updated);
    });
  }

  if (!expanded) {
    return (
      <div className="orb-shell">
        <button
          className="orb-button"
          aria-label={`Cairvia orb, ${visual}`}
          onClick={togglePanel}
          onContextMenu={openMenu}
        />
      </div>
    );
  }

  if (menuOpen) {
    return (
      <div className="orb-shell">
        <div className="menu" role="menu" aria-label="Orb actions">
          <button type="button" onClick={() => void resume()}>
            Resume
          </button>
          <button type="button" onClick={() => void capture()}>
            Capture recovery
          </button>
          <button
            type="button"
            onClick={() => {
              if (thread?.nextActionRequest?.toolId === "copy_to_clipboard") {
                void window.cairvia.invoke("cairvia:action:execute", {
                  toolId: "copy_to_clipboard",
                  input: thread.nextActionRequest.input,
                  threadId: thread.id
                });
              }
            }}
          >
            Copy next action
          </button>
          <button type="button" onClick={() => window.cairvia.openControlCenter()}>
            Open Control Center
          </button>
          <button type="button" onClick={() => window.cairvia.quit()}>
            Quit
          </button>
          <button type="button" onClick={togglePanel}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="orb-shell">
      <section className="panel" aria-label="Current Work Thread">
        <StatusDot state={visual} />
        {offline ? <Banner>Offline — using local Work Thread.</Banner> : null}
        {thread ? (
          <>
            <p className="muted">You were working on</p>
            <h1 style={{ fontSize: "1.25rem" }}>
              {thread.project ?? thread.intent}
            </h1>
            <p>{thread.intent}</p>
            <p className="muted">You stopped at</p>
            <p>{thread.currentState}</p>
            {thread.blockers[0] ? (
              <p>
                <strong>Blocked:</strong> {thread.blockers[0]}
              </p>
            ) : null}
            {alreadyTried.length > 0 ? (
              <p className="muted">Already in evidence: {alreadyTried.join(" · ")}</p>
            ) : null}
            <div className="next">
              <p className="muted">NEXT ACTION</p>
              <h2 style={{ fontSize: "1.05rem" }}>{thread.nextAction}</h2>
              {thread.estimatedEffort ? (
                <p className="muted">{thread.estimatedEffort}</p>
              ) : null}
            </div>
            {message ? <Banner>{message}</Banner> : null}
            <div className="actions">
              <Button onClick={() => void resume()}>Resume</Button>
              <Button variant="secondary" onClick={() => void markProgress()}>
                Mark progress
              </Button>
              <Button variant="ghost" onClick={() => void stopWork()}>
                Stop
              </Button>
              <Button variant="ghost" onClick={() => void capture()}>
                Capture
              </Button>
              <Button variant="ghost" onClick={togglePanel}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <p>No Work Thread yet.</p>
        )}
      </section>
    </div>
  );
}
