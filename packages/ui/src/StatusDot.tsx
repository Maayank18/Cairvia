import type { OrbVisualState } from "@cairvia/schemas";

const COLORS: Record<OrbVisualState, string> = {
  IDLE: "var(--muted)",
  THINKING: "var(--accent)",
  READY: "var(--ready)",
  WORKING: "var(--working)",
  WAITING_FOR_APPROVAL: "var(--wait)",
  SUCCESS: "var(--success)",
  ERROR: "var(--error)",
  OFFLINE: "var(--offline)"
};

export function StatusDot({
  state,
  label
}: {
  state: OrbVisualState;
  label?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: COLORS[state],
          boxShadow: `0 0 0 3px color-mix(in srgb, ${COLORS[state]} 25%, transparent)`
        }}
      />
      <span>{label ?? state.replaceAll("_", " ")}</span>
    </span>
  );
}
