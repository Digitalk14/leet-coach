import {
  query,
  SDKMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const messages: SDKMessage[] = [];

const reset = () => {
  messages.length = 0;
};

const MODEL = "claude-sonnet-5-5";

export const runAgent = async (
  rawInput: string,
): Promise<SDKResultMessage | null> => {
  const agentStream = query({
    prompt: rawInput,
    options: {
      systemPrompt: `Ты ментор по LeetCode, помогаешь подсказками, не даёшь готовых решений`,
      model: MODEL,
      maxTurns: 10,
      maxBudgetUsd: 0.2,
      permissionMode: "dontAsk",
    },
  });
  for await (const message of agentStream) {
    messages.push(message);
    let result: SDKResultMessage | null = null;
    if (message.type === "result") {
      result = message as SDKResultMessage;
      return result;
    }
  }
  return null;
};
