import { useEffect, useRef, useState } from "react";
import type { OrbVisualState, ResumeCardV1, WorkThreadV1 } from "@cairvia/schemas";
import { LOCAL_API_ORIGIN } from "@cairvia/config/constants";

const STATE_COLOR: Record<OrbVisualState, string> = {
  IDLE: "#c4a574",
  THINKING: "#d4b896",
  READY: "#7eb8a2",
  WORKING: "#6ea8ff",
  WAITING_FOR_APPROVAL: "#e0b15a",
  SUCCESS: "#8fce7a",
  ERROR: "#e07a6a",
  OFFLINE: "#8a8378"
};

const IDLE_MS = 2 * 60 * 1000;
const DRAG_PX = 8;

function useWindowDrag(onClick?: () => void) {
  const pressing = useRef(false);
  const moved = useRef(false);
  const origin = useRef({ x: 0, y: 0 });

  return {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      pressing.current = true;
      moved.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      window.cairvia?.dragStart();
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (!pressing.current) {
        return;
      }
      const dist = Math.hypot(
        event.clientX - origin.current.x,
        event.clientY - origin.current.y
      );
      if (dist > DRAG_PX) {
        moved.current = true;
        window.cairvia?.dragMove();
      }
    },
    onPointerUp(event: React.PointerEvent<HTMLElement>) {
      if (!pressing.current) {
        return;
      }
      pressing.current = false;
      window.cairvia?.dragEnd();
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      if (!moved.current) {
        onClick?.();
      }
    }
  };
}

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [thread, setThread] = useState<WorkThreadV1 | null>(null);
  const [card, setCard] = useState<ResumeCardV1 | null>(null);
  const [state, setState] = useState<OrbVisualState>("IDLE");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [message, setMessage] = useState<string | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const loadRef = useRef<() => Promise<WorkThreadV1 | null>>(async () => null);
  const clickRef = useRef<() => void>(() => undefined);

  const visual: OrbVisualState = offline ? "OFFLINE" : state;
  const orbDrag = useWindowDrag(() => clickRef.current());
  const welcomeBack = Boolean(
    thread &&
      ["PAUSED", "INTERRUPTED", "RECOVERABLE", "BLOCKED"].includes(thread.status)
  );

  async function loadThread(): Promise<WorkThreadV1 | null> {
    try {
      const next = (await window.cairvia.invoke(
        "cairvia:thread:getActive"
      )) as WorkThreadV1 | null;
      if (next) {
        setThread(next);
      } else if (!offline) {
        setThread(null);
      }
      try {
        const resume = (await window.cairvia.invoke(
          "cairvia:recovery:card"
        )) as ResumeCardV1;
        if (resume?.threadId) {
          setCard(resume);
        }
      } catch {
        setOffline(true);
      }
      if (next) {
        setState("READY");
      }
      return next ?? thread;
    } catch {
      setOffline(true);
      return thread;
    }
  }

  loadRef.current = loadThread;

  useEffect(() => {
    void loadThread();
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    const onVis = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current >= IDLE_MS) {
        void window.cairvia.invoke("cairvia:snapshot:idle", {
          id: thread?.id
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = window.cairvia?.onLayout((open) => {
      setExpanded(open);
      if (!open) {
        setMenuOpen(false);
      }
    }) ?? (() => undefined);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [thread?.id]);

  useEffect(() => {
    const source = new EventSource(`${LOCAL_API_ORIGIN}/v1/sync/stream`);
    const refresh = () => {
      void loadRef.current();
    };
    source.addEventListener("THREAD_UPDATED", refresh);
    source.addEventListener("THREAD_INTERRUPTED", refresh);
    source.addEventListener("RECOVERY_CAPTURED", refresh);
    source.addEventListener("THREAD_RECOVERED", refresh);
    source.addEventListener("COMMITMENT_CONFIRMED", refresh);
    source.addEventListener("ACTION_SUCCEEDED", refresh);
    return () => source.close();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--orb-color", STATE_COLOR[visual]);
  }, [visual]);

  function togglePanel() {
    const next = !expanded;
    setExpanded(next);
    setMenuOpen(false);
    window.cairvia?.expand(next);
    if (next) {
      void loadThread();
    }
  }

  clickRef.current = togglePanel;

  function openMenu(event: React.MouseEvent) {
    event.preventDefault();
    setMenuOpen((open) => !open);
    if (!expanded) {
      setExpanded(true);
      window.cairvia?.expand(true);
    }
  }

  async function run(label: string, work: () => Promise<void>) {
    try {
      setState("WORKING");
      setMessage(null);
      await work();
      setState("SUCCESS");
    } catch (error) {
      setState("ERROR");
      const raw = error instanceof Error ? error.message : label;
      setMessage(
        raw.toLowerCase().includes("model") || raw.toLowerCase().includes("bedrock")
          ? "Couldn't finish that step. The thread is safe."
          : "That action did not complete."
      );
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
      await loadThread();
    });
  }

  async function stopWork() {
    if (!thread) {
      return;
    }
    await run("pause", async () => {
      await window.cairvia.invoke("cairvia:thread:captureRecovery", {
        id: thread.id
      });
      await loadThread();
    });
  }

  return (
    <div className={expanded ? "orb-root is-open" : "orb-root"}>
      {expanded ? (
        <section className="sheet" aria-label="Current Work Thread">
          {menuOpen ? (
            <div className="sheet-menu" role="menu">
              <button type="button" onClick={() => window.cairvia.openControlCenter()}>
                Control Center
              </button>
              <button type="button" onClick={() => window.cairvia.quit()}>
                Quit
              </button>
            </div>
          ) : thread && card ? (
            <>
              <p className="kicker">
                <span className={`pip pip--${visual.toLowerCase()}`} />
                {offline ? "Offline" : welcomeBack ? "Welcome back" : "Now"}
              </p>
              <h1>{card.whatIWasDoing}</h1>
              <p className="stopped">{card.whereIStopped}</p>
              {card.blocker ? <p className="block">{card.blocker}</p> : null}
              <p className="next">{card.nextAction}</p>
              {message ? <p className="note">{message}</p> : null}
              <div className="actions">
                <button type="button" className="act act--primary" onClick={() => void resume()}>
                  Resume
                </button>
                <button type="button" className="act" onClick={() => void stopWork()}>
                  Stop
                </button>
              </div>
            </>
          ) : (
            <p className="empty">No thread yet. Open Control Center to start one.</p>
          )}
        </section>
      ) : null}
      <button
        type="button"
        className="orb-button"
        aria-label={
          expanded
            ? "Close Cairvia orb"
            : `Open Cairvia orb, ${visual}`
        }
        aria-expanded={expanded}
        onPointerDown={orbDrag.onPointerDown}
        onPointerMove={orbDrag.onPointerMove}
        onPointerUp={orbDrag.onPointerUp}
        onContextMenu={openMenu}
      />
    </div>
  );
}
