import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { executeTool, DecisionSchema } from "../utils/execute-tool";


const MODEL = "claude-sonnet-5-5";
const MAX_ITERATIONS = 10;

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"], // This is the default and can be omitted
});

export type AgentInput = { messages: Anthropic.MessageParam[] };

export type AgentResult = {
  text: string;
};

const decideTool: Anthropic.Tool = {
  name: "decide",
  description: "Choose the next step",
  input_schema: z.toJSONSchema(DecisionSchema) as Anthropic.Tool.InputSchema,
};

const systemPrompt = `You are a mentor for LeetCode, helping with hints, not giving ready solutions`;

export const runAgent = async ({ messages }: AgentInput) => {
  const history = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: history, // вся история
      tools: [decideTool],
      tool_choice: { type: "tool", name: "decide" },
    });
    const block = response.content.find((b) => b.type === "tool_use");
    if (!block) throw new Error("No decision");

    const decision = DecisionSchema.parse(block.input);

    if (decision.action === "final") return { text: decision.answer };
    if (decision.action === "failed")
      return { text: `Agent failed: ${decision.answer}` };

    let result: string;

    try {
      result = JSON.stringify(await executeTool(decision));
    } catch (e) {
      result = `Tool failed: ${e instanceof Error ? e.message : "unknown"}`;
    }
    history.push({ role: "assistant", content: response.content });
    history.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: block.id, content: result }],
    });
  }

  return { text: "Agent failed: max iterations reached" };
};
