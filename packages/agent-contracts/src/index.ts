import type { WorkThreadV1 } from "@cairvia/schemas";

export type AgentSkillName =
  | "thread_state"
  | "next_action"
  | "recovery"
  | "commitment_extraction";

export interface AgentRequestV1 {
  schemaVersion: "AgentRequestV1";
  skill: AgentSkillName;
  thread: WorkThreadV1;
  utterance?: string;
}

export interface AgentProposalV1 {
  schemaVersion: "AgentProposalV1";
  skill: AgentSkillName;
  nextAction: string;
  rationale: string;
  toolId?: string;
}

/**
 * Phase 1: contracts only. The supervisor must never execute
 * high-risk tools. Capabilities request; policy checks; runtime executes.
 */
export interface CairviaSupervisor {
  propose(request: AgentRequestV1): Promise<AgentProposalV1>;
}
