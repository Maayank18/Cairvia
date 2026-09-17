import type { CSSProperties } from "react";
import type { EvidenceLabel } from "@cairvia/schemas";

const COLORS: Record<EvidenceLabel, string> = {
  Confirmed: "var(--ready)",
  Inferred: "var(--working)",
  Candidate: "var(--wait)",
  Stale: "var(--offline)"
};

export function EvidenceBadge({ label }: { label: EvidenceLabel }) {
  const style: CSSProperties = {
    display: "inline-block",
    padding: "0.15rem 0.55rem",
    borderRadius: 999,
    border: `1px solid ${COLORS[label]}`,
    color: COLORS[label],
    fontSize: "0.75rem",
    fontWeight: 600
  };
  return <span style={style}>{label}</span>;
}
