export type ThreadBeat =
  | "INTENT"
  | "CURRENT STATE"
  | "NEXT ACTION"
  | "WORKING"
  | "INTERRUPTED"
  | "RECOVERY"
  | "RESUME"
  | "VERIFIED";

const NODES = [
  { id: "Intent", beats: ["INTENT"] },
  { id: "Current state", beats: ["CURRENT STATE", "WORKING"] },
  { id: "Decision", beats: ["WORKING"] },
  { id: "Next action", beats: ["NEXT ACTION", "RESUME"] },
  { id: "Interruption", beats: ["INTERRUPTED"] },
  { id: "Recovery capsule", beats: ["RECOVERY"] },
  { id: "Resume", beats: ["RESUME"] },
  { id: "Verified", beats: ["VERIFIED"] }
] as const;

export function WorkThreadVisual({
  beat,
  onSelect
}: {
  beat: ThreadBeat;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="thread-visual" role="list" aria-label="Work Thread">
      {beat === "WORKING" ? <span className="signal" aria-hidden="true" /> : null}
      {NODES.map((item) => {
            const live = (item.beats as readonly string[]).includes(beat);
        return (
          <button
            key={item.id}
            type="button"
            role="listitem"
            className={`thread-node${live ? " is-live pulse" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <small>{live ? beat : "Node"}</small>
            <strong>{item.id}</strong>
          </button>
        );
      })}
    </div>
  );
}
