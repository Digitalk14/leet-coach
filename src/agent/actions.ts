"use server";

import { runAgent } from "@/agent/core/run-agent";

export async function runAgentAction(input: string) {
  return runAgent(input);
}
