import { z } from "zod";
import { leetcodeSearch, runTests } from "../tools";

const searchDecision = z.object({
  action: z.literal("leetcodesearch"),
  reason: z.string(),
  arguments: z.object({
    query: z.string(),
  }),
});

const runTestsDecision = z.object({
  action: z.literal("runtests"),
  reason: z.string(),
  arguments: z.object({
    code: z.string(),
    tests: z.string(),
  }),
});

const answerDecision = z.object({
  action: z.enum(["final", "failed"]),
  reason: z.string(),
  answer: z.string(),
});

export const DecisionSchema = z.discriminatedUnion("action", [
  searchDecision,
  runTestsDecision,
  answerDecision,
]);

/** Flat object schema for the API. A discriminated union has no root `type`, which Anthropic rejects. */
export const DecisionToolSchema = z.object({
  action: z.enum(["leetcodesearch", "final", "failed"]),
  reason: z.string(),
  arguments: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "LeetCode problem slug: lowercase words joined by hyphens, as in the problem URL. Example: 'two-sum', 'longest-substring-without-repeating-characters'",
      ),
  }),
  answer: z
    .string()
    .optional()
    .describe("Required when action is final or failed"),
});

type Decision = z.infer<typeof DecisionSchema>;

export const executeTool = async (decision: Decision) => {
  if (decision.action !== "leetcodesearch") {
    throw new Error("Invalid action");
  }
  if (decision.action === "runtests") {
    const result = await runTests(
      decision.arguments.code,
      decision.arguments.tests,
      decision.arguments.functionName,
    );
    return result;
  }

  const result = await leetcodeSearch(decision.arguments.query, "typescript");
  return result;
};
