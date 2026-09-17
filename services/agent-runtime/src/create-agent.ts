import { Agent, BedrockModel, tool } from "@strands-agents/sdk";
import { z } from "zod";
import type { AppKernel } from "@cairvia/api";
import { runBoundedTool } from "./tools.js";

export function createStrandsAgent(kernel: AppKernel) {
  const model = new BedrockModel({
    region: process.env.AWS_REGION ?? "us-east-1",
    modelId:
      process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20241022-v2:0",
    maxTokens: 256,
    temperature: 0.1
  });

  const getActiveThread = tool({
    name: "get_active_thread",
    description: "Return the current Work Thread. DynamoDB is the source of truth.",
    inputSchema: z.object({}),
    callback: async () => JSON.stringify(await runBoundedTool(kernel, "get_active_thread"))
  });
  const getRecentSnapshots = tool({
    name: "get_recent_snapshots",
    description: "Return recent context snapshots for a thread.",
    inputSchema: z.object({ threadId: z.string().optional() }),
    callback: async (input) =>
      JSON.stringify(await runBoundedTool(kernel, "get_recent_snapshots", input))
  });
  const getConfirmedContext = tool({
    name: "get_confirmed_context",
    description: "Return user-confirmed context items only.",
    inputSchema: z.object({ threadId: z.string().optional() }),
    callback: async (input) =>
      JSON.stringify(await runBoundedTool(kernel, "get_confirmed_context", input))
  });
  const proposeNextAction = tool({
    name: "propose_next_action",
    description: "Return the stored next action. Do not invent work.",
    inputSchema: z.object({}),
    callback: async () =>
      JSON.stringify(await runBoundedTool(kernel, "propose_next_action"))
  });
  const createCandidateCommitment = tool({
    name: "create_candidate_commitment",
    description: "Create a candidate commitment. Execution waits for user approval.",
    inputSchema: z.object({
      selectedText: z.string(),
      pageTitle: z.string().optional(),
      pageUrl: z.string().optional(),
      threadId: z.string().optional()
    }),
    callback: async (input) =>
      JSON.stringify(
        await runBoundedTool(kernel, "create_candidate_commitment", input)
      )
  });

  return new Agent({
    model,
    printer: false,
    systemPrompt: [
      "You are Cairvia, a continuity agent.",
      "Work Thread state in DynamoDB is canonical. Do not treat memory as source of truth.",
      "Never invent a next action. Use propose_next_action.",
      "Never claim you sent messages or wrote files.",
      "Keep answers to one next action."
    ].join(" "),
    tools: [
      getActiveThread,
      getRecentSnapshots,
      getConfirmedContext,
      proposeNextAction,
      createCandidateCommitment
    ]
  });
}
