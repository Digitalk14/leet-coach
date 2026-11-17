import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { executeTool, DecisionSchema, DecisionToolSchema } from "../utils";

const MODEL = "claude-sonnet-5-5";
const MAX_ITERATIONS = 10;

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"], // This is the default and can be omitted
});

export type AgentInput = { messages: Anthropic.MessageParam[] };

export type TimelineStep = {
  action: "leetcodesearch" | "final" | "failed" | "invalid"; // decision.action
  reason: string; // decision.reason, «почему модель так решила»
  input?: unknown; // decision.arguments, например { query: "two-sum" }
  result?: string; // что вернула тулза, коротко
  status: "ok" | "error"; // тулза отработала или упала
  durationMs: number; // сколько занял шаг
};

export type AgentResult = {
  text: string;
  messages: Anthropic.MessageParam[];
  steps: TimelineStep[];
  problem?: { title: string; starterCode: string };
};

const decideTool: Anthropic.Tool = {
  name: "decide",
  description: "Choose the next step",
  input_schema: z.toJSONSchema(
    DecisionToolSchema,
  ) as Anthropic.Tool.InputSchema,
};

const pushStep = (
  steps: TimelineStep[],
  step: Omit<TimelineStep, "durationMs">,
  startedAt: number,
) => {
  steps.push({ ...step, durationMs: Date.now() - startedAt });
};

const systemPrompt = `You are a mentor for LeetCode, helping with hints, not giving ready solutions. Before giving any hint, always fetch the problem with leetcodesearch. Use only the data from the tool. If the tool returns nothing, respond with failed`;

export const runAgent = async ({
  messages,
}: AgentInput): Promise<AgentResult> => {
  const history = [...messages];
  const steps: TimelineStep[] = [];
  let problem: AgentResult["problem"];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const startedAt = Date.now();
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
      const text = response.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) {
        history.push({ role: "assistant", content: text });
        pushStep(
          steps,
          {
            action: "final",
            reason: "Model answered in text",
            result: text,
            status: "ok",
          },
          startedAt,
        );
        return { text, messages: history, steps, problem };
      }
      history.push({ role: "assistant", content: response.content });
      history.push({
        role: "user",
        content:
          "You must respond by calling the decide tool. Do not answer with plain text.",
      });
      pushStep(
        steps,
        {
          action: "invalid",
          reason: "Model answered without decide, asking it to retry",
          status: "error",
        },
        startedAt,
      );
      continue;
    }

    const parsed = DecisionSchema.safeParse(block.input);
    if (!parsed.success) {
      const message = `Invalid decision: ${parsed.error.message}`;
      history.push({ role: "assistant", content: response.content });
      history.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: block.id,
            content: message,
            is_error: true,
          },
        ],
      });
      pushStep(
        steps,
        {
          action: "invalid",
          reason: message,
          input: block.input,
          result: message,
          status: "error",
        },
        startedAt,
      );
      continue;
    }
    const decision = parsed.data;

    if (decision.action === "leetcodesearch") {
      let result: string;
      let status: TimelineStep["status"] = "ok";
      try {
        const data = await executeTool(decision);
        result = JSON.stringify(data ?? null);
        if (data)
          problem = { title: data.title, starterCode: data.starterCode };
      } catch (e) {
        status = "error";
        result = `Tool failed: ${e instanceof Error ? e.message : "unknown"}`;
      }
      pushStep(
        steps,
        {
          action: decision.action,
          reason: decision.reason,
          input: decision.arguments,
          result,
          status,
        },
        startedAt,
      );
      history.push({ role: "assistant", content: response.content });
      history.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
            is_error: status === "error",
          },
        ],
      });
      continue;
    }

    const text =
      decision.action === "final"
        ? decision.answer
        : `Agent failed: ${decision.answer}`;
    history.push({ role: "assistant", content: text });
    pushStep(
      steps,
      {
        action: decision.action,
        reason: decision.reason,
        result: decision.answer,
        status: decision.action === "final" ? "ok" : "error",
      },
      startedAt,
    );
    return { text, messages: history, steps, problem };
  }

  const text = "Agent failed: max iterations reached";
  history.push({ role: "assistant", content: text });
  steps.push({
    action: "failed",
    reason: text,
    result: text,
    status: "error",
    durationMs: 0,
  });
  return { text, messages: history, steps, problem };
};
