import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { executeTool, DecisionSchema, DecisionToolSchema } from "../utils";

const MODEL = "claude-sonnet-5-5";
const MAX_ITERATIONS = 10;

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"], // This is the default and can be omitted
});

export type AgentInput = { messages: Anthropic.MessageParam[] };

export type AgentResult = {
  text: string;
  messages: Anthropic.MessageParam[];
};

const decideTool: Anthropic.Tool = {
  name: "decide",
  description: "Choose the next step",
  input_schema: z.toJSONSchema(DecisionToolSchema) as Anthropic.Tool.InputSchema,
};

const systemPrompt = `You are a mentor for LeetCode, helping with hints, not giving ready solutions`;

export const runAgent = async ({ messages }: AgentInput): Promise<AgentResult> => {
  const history = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
      tools: [decideTool],
      tool_choice: { type: "auto" },
    });
    const block = response.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      const text =
        response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim() || "Agent returned an empty response";
      history.push({ role: "assistant", content: text });
      return { text, messages: history };
    }

    const parsed = DecisionSchema.safeParse(block.input);
    if (!parsed.success) {
      history.push({ role: "assistant", content: response.content });
      history.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: block.id,
            content: `Invalid decision: ${parsed.error.message}`,
            is_error: true,
          },
        ],
      });
      continue;
    }
    const decision = parsed.data;

    if (decision.action === "final" || decision.action === "failed") {
      const text =
        decision.action === "final" ? decision.answer : `Agent failed: ${decision.answer}`;
      history.push({ role: "assistant", content: text });
      return { text, messages: history };
    }

    let result: string;

    try {
      result = JSON.stringify((await executeTool(decision)) ?? null);
    } catch (e) {
      result = `Tool failed: ${e instanceof Error ? e.message : "unknown"}`;
    }
    history.push({ role: "assistant", content: response.content });
    history.push({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: block.id, content: result },
      ],
    });
  }

  const text = "Agent failed: max iterations reached";
  history.push({ role: "assistant", content: text });
  return { text, messages: history };
};
