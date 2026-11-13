import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5-5";

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"], // This is the default and can be omitted
});

export type AgentInput = { messages: Anthropic.MessageParam[] };

export type AgentResult = {
  text: string;
};

const systemPrompt = `You are a mentor for LeetCode, helping with hints, not giving ready solutions`;

export const runAgent = async ({
  messages,
}: AgentInput) => {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages, // вся история
  });
  const text = message.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n");
  return { text };
};
