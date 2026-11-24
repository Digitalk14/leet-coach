import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { runTests } from "../tools";
import { executeTool, DecisionSchema, DecisionToolSchema } from "../utils";

const MODEL = "claude-sonnet-5-5";
const MAX_ITERATIONS = 10;

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"], // This is the default and can be omitted
});

export type Problem = {
  title: string;
  starterCode: string;
  functionName: string;
  tests: unknown[][];
};

export type AgentInput = {
  sessionId: string;
  messages: Anthropic.MessageParam[];
  code?: string;
  problem?: Problem;
};

export type TimelineStep = {
  action: "leetcodesearch" | "run_tests" | "final" | "failed" | "invalid"; // decision.action
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
  problem?: Problem;
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

const systemPrompt = `You are a mentor for LeetCode, helping with hints, not giving ready solutions. Before giving any hint, always fetch the problem with leetcodesearch. When the user submits a solution, call run_tests first. Compare the outputs with the expected outputs from the problem description and base your feedback on them. Use only the data from the tool. If the tool returns nothing, respond with failed`;

const runLoop = async ({
  history,
  code,
  problem: loadedProblem,
}: {
  history: Anthropic.MessageParam[];
  code?: string;
  problem?: Problem;
}): Promise<AgentResult> => {
  const steps: TimelineStep[] = [];
  let problem = loadedProblem;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const startedAt = Date.now();
    const response = await startActiveObservation(
      "llm-call",
      async (gen) => {
        const r = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [...history],
          tools: [decideTool],
          tool_choice: { type: "auto" },
        });
        gen.update({
          model: MODEL,
          usageDetails: {
            input: r.usage.input_tokens,
            output: r.usage.output_tokens,
          },
          output: r.content,
        });
        return r;
      },
      { asType: "generation" },
    );

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
        const data = await startActiveObservation(
          "leetcodesearch-tool",
          async (trace) => {
            trace.update({ input: decision });
            const result = await executeTool(decision);
            trace.update({ output: result });
            return result;
          },
          { asType: "tool" },
        );
        result = JSON.stringify(data ?? null);
        if (data) {
          problem = {
            title: data.title,
            starterCode: data.starterCode ?? "",
            functionName: data.functionName,
            tests: data.tests,
          };
        }
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

    if (decision.action === "run_tests") {
      let result: string;
      let status: TimelineStep["status"] = "ok";
      if (!code || !problem) {
        status = "error";
        result = "No code or problem loaded";
      } else {
        const currentProblem = problem;
        try {
          const results = await startActiveObservation(
            "run-tests-tool",
            async (trace) => {
              trace.update({
                input: {
                  code,
                  functionName: currentProblem.functionName,
                  tests: currentProblem.tests,
                },
              });
              const result = runTests(
                code,
                currentProblem.functionName,
                currentProblem.tests,
              );
              trace.update({ output: result });
              return result;
            },
            { asType: "tool" },
          );
          result = JSON.stringify(results);
        } catch (e) {
          status = "error";
          result = `Tool failed: ${e instanceof Error ? e.message : "unknown"}`;
        }
      }
      pushStep(
        steps,
        {
          action: decision.action,
          reason: decision.reason,
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

export const runAgent = async ({
  messages,
  code,
  problem: loadedProblem,
  sessionId,
}: AgentInput): Promise<AgentResult> => {
  const history = [...messages];

  return propagateAttributes({ sessionId }, () =>
    startActiveObservation("agent-run", async (trace) => {
      trace.update({ input: messages.at(-1) });
      const result = await runLoop({
        history,
        code,
        problem: loadedProblem,
      });
      trace.update({ output: result.text });
      return result;
    }),
  );
};
