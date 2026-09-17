import type { ResumeCardV1, WorkThreadV1 } from "@cairvia/schemas";
import { ContinuityService, planNextAction } from "@cairvia/domain";

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

export interface CairviaSupervisor {
  propose(request: AgentRequestV1): Promise<AgentProposalV1>;
}

export function createLocalSupervisor(
  continuity: ContinuityService
): CairviaSupervisor {
  return {
    async propose(request) {
      if (request.skill === "recovery") {
        const card: ResumeCardV1 = await continuity.resumeCard();
        return {
          schemaVersion: "AgentProposalV1",
          skill: "recovery",
          nextAction: card.nextAction,
          rationale: card.whatIWasDoing
        };
      }
      const planned = planNextAction(request.thread);
      return {
        schemaVersion: "AgentProposalV1",
        skill: request.skill,
        nextAction: planned.nextAction,
        rationale: planned.whyNow
      };
    }
  };
}
