"use server";

import { runAgent, type AgentInput } from "@/agent/core/run-agent";

export async function runAgentAction(input: AgentInput) {
  return runAgent(input);
}
