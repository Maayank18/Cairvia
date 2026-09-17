export function observe(fields: {
  requestId?: string;
  threadId?: string;
  agentInvocationId?: string;
  modelLatencyMs?: number;
  modelError?: string;
  toolCalls?: string[];
  authorization?: string;
  userApproval?: boolean;
  result?: string;
}): void {
  const line = {
    ...fields,
    ts: new Date().toISOString()
  };
  console.log(JSON.stringify(line));
}
