import { useEffect, useState } from "react";
import { Button } from "@cairvia/ui";
import { useQuery } from "@tanstack/react-query";
import type { ResumeCardV1, WorkThreadV1 } from "@cairvia/schemas";
import { api } from "../api";
import { WorkThreadVisual, type ThreadBeat } from "./WorkThreadVisual";

const BEATS: ThreadBeat[] = [
  "INTENT",
  "CURRENT STATE",
  "NEXT ACTION",
  "WORKING",
  "INTERRUPTED",
  "RECOVERY",
  "RESUME",
  "VERIFIED"
];

const NODE_COPY: Record<string, string> = {
  Intent: "Why this work exists. The outcome you still owe yourself.",
  "Current state": "The last verified place in the work, not a transcript dump.",
  Decision: "A choice already made, so you do not reopen it by habit.",
  "Next action": "One concrete step. Not a backlog.",
  Interruption: "The thread pauses. Context is captured, not guessed later.",
  "Recovery capsule": "Compressed, structured state you can return to.",
  Resume: "From remembering to continuing — a real, authorized action.",
  Verified: "The step completed. The thread can move forward."
};

const AWS_NODES = [
  { name: "Cognito", meaning: "Identity for people using Cairvia." },
  { name: "API Gateway", meaning: "Authenticated API boundary." },
  { name: "Lambda", meaning: "Serverless handlers for thread, recovery, and actions." },
  { name: "DynamoDB", meaning: "Durable Work Thread state. Source of truth in AWS." },
  { name: "S3", meaning: "Optional larger artifacts. Not desktop captures." },
  { name: "EventBridge", meaning: "Domain events, including explicit browser capture." },
  { name: "Step Functions", meaning: "Durable commitment workflow after capture." },
  { name: "Bedrock", meaning: "Model inference when enabled. Invalid output is rejected." },
  { name: "AgentCore Runtime", meaning: "HTTP agent contract. Not a simulated gateway." },
  { name: "CloudWatch", meaning: "Structured logs with identifiers, not private dumps." }
];

export function StoryPage({ onOpen }: { onOpen: () => void }) {
  const [beat, setBeat] = useState(0);
  const [node, setNode] = useState("Intent");
  const [aws, setAws] = useState(AWS_NODES[3]!);
  const [resumePhase, setResumePhase] = useState("RECOVERED");
  const live = useQuery({
    queryKey: ["story-live"],
    queryFn: async () => {
      const thread = await api<{ thread: WorkThreadV1 | null }>("/threads/active");
      const card = await api<{ card: ResumeCardV1 }>("/recovery/card");
      return { thread: thread.thread, card: card.card };
    },
    retry: false
  });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      return;
    }
    const id = window.setInterval(() => {
      setBeat((value) => (value + 1) % BEATS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  const card = live.data?.card;
  const thread = live.data?.thread;
  const hasLive = Boolean(card?.threadId && thread);

  return (
    <article className="story">
      <section className="hero">
        <div>
          <p className="eyebrow">Cairvia</p>
          <h1>
            Keep
            <br />
            the thread.
          </h1>
          <p className="lede">
            Context survives the interruption. Cairvia stores the smallest useful
            state so you can continue: intent, current state, and one next action.
          </p>
          <div className="row">
            <Button onClick={onOpen}>Open Cairvia</Button>
          </div>
        </div>
        <WorkThreadVisual beat={BEATS[beat]!} onSelect={setNode} />
      </section>

      <section>
        <p className="eyebrow">The problem</p>
        <h2>The work didn’t disappear. The context did.</h2>
        <p className="lede">
          Coding, a tab, a message, a meeting, another task. Hours later the files
          are still there. The thread is not.
        </p>
        <div className="fragments" aria-hidden="true">
          {["Code", "Browser", "Meeting", "Message", "Document", "Notification"].map(
            (item, index) => (
              <span key={item} className={index > 2 ? "chip is-break" : "chip"}>
                {item}
              </span>
            )
          )}
        </div>
        <p className="question">What was I doing?</p>
      </section>

      <section>
        <p className="eyebrow">Interruption</p>
        <h2>Interruptions happen. The work state shouldn’t vanish with them.</h2>
        <p className="lede">
          When the thread breaks, Cairvia captures intent, current state, last
          decision, evidence, and the next action — not a surveillance log.
        </p>
      </section>

      <section>
        <p className="eyebrow">The Work Thread</p>
        <h2>One continuous object. Not three apps.</h2>
        <div className="explore">
          <WorkThreadVisual beat="NEXT ACTION" onSelect={setNode} />
          <div className="meaning card">
            <p className="eyebrow">{node}</p>
            <p>{NODE_COPY[node] ?? "Select a node on the thread."}</p>
          </div>
        </div>
      </section>

      <section>
        <p className="eyebrow">Where was I?</p>
        <h2>Recover the state. Then continue.</h2>
        {hasLive ? (
          <dl className="capsule">
            <dt>You were working on</dt>
            <dd>{card?.whatIWasDoing}</dd>
            <dt>Current state</dt>
            <dd>{card?.whereIStopped}</dd>
            <dt>Next action</dt>
            <dd>{card?.nextAction}</dd>
            <dt>Evidence</dt>
            <dd>{thread?.evidenceRefs.join(" · ") || "None stored"}</dd>
          </dl>
        ) : (
          <dl className="capsule">
            <dt>Illustration</dt>
            <dd>No live thread is loaded. This is the shape of a recovery, not a fake metric.</dd>
            <dt>You were working on</dt>
            <dd>Debugging authentication</dd>
            <dt>Current state</dt>
            <dd>API responds correctly</dd>
            <dt>Last decision</dt>
            <dd>Keep refresh-token flow unchanged</dd>
            <dt>Next action</dt>
            <dd>Run token refresh test</dd>
          </dl>
        )}
        <div className="row">
          <Button
            onClick={() => {
              setResumePhase("ACTION");
              onOpen();
            }}
          >
            Resume
          </Button>
          <p className="lede" style={{ margin: 0 }}>
            Resume is not a slogan. In NOW it runs an authorized LOW action.
          </p>
        </div>
        <p className="eyebrow">{resumePhase} → READY → VERIFY → CONTINUE</p>
      </section>

      <section>
        <p className="eyebrow">Three surfaces</p>
        <h2>Three surfaces. One continuous thread.</h2>
        <div className="surfaces">
          <article className="surface">
            <h3>Orb</h3>
            <p>Immediate execution. What am I doing? What next? Resume.</p>
          </article>
          <article className="surface">
            <h3>Extension</h3>
            <p>Selected text only. Captured when you ask. Never a browsing history.</p>
          </article>
          <article className="surface">
            <h3>Website</h3>
            <p>Visibility and control. NOW, THREADS, AUTOMATIONS, CONTROL.</p>
          </article>
        </div>
      </section>

      <section>
        <p className="eyebrow">Execution</p>
        <h2>Propose. Authorize. Execute. Verify.</h2>
        <p className="lede">
          AI may interpret and propose. Policy and code authorize, execute, and
          verify. Invalid model output does not become an action.
        </p>
        <div className="flow-row">
          {["Remember", "Understand", "Propose", "Authorize", "Execute", "Verify"].map(
            (step) => (
              <span key={step}>{step}</span>
            )
          )}
        </div>
      </section>

      <section>
        <p className="eyebrow">Control</p>
        <h2>Your context. Your permissions. Your approval.</h2>
        <p className="lede">
          Cairvia acts only inside allowlisted LOW tools. You remain in control of
          what is captured and what may run.
        </p>
      </section>

      <section>
        <p className="eyebrow">Architecture</p>
        <h2>How Cairvia actually holds the thread</h2>
        <p className="lede">
          Surfaces share one Work Thread. In AWS, DynamoDB is the durable source of
          truth. Agent memory is not.
        </p>
        <div className="arch">
          {AWS_NODES.map((item) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={aws.name === item.name}
              onClick={() => setAws(item)}
            >
              <strong>{item.name}</strong>
            </button>
          ))}
        </div>
        <p className="card" style={{ marginTop: "1rem" }}>
          {aws.name}: {aws.meaning}
        </p>
      </section>

      <section className="cta-end">
        <p className="eyebrow">Continue</p>
        <h2>The thread doesn’t have to break.</h2>
        <p className="lede">
          Keep the context. Recover the state. Continue the work.
        </p>
        <Button onClick={onOpen}>Open Cairvia</Button>
      </section>
    </article>
  );
}
