import { z } from "zod";
import { leetcodeSearch } from "../tools";

const searchDecision = z.object({
  action: z.literal("leetcodesearch"),
  reason: z.string(),
  arguments: z.object({
    query: z.string(),
  }),
});

const runTestsDecision = z.object({
  action: z.literal("run_tests"),
  reason: z.string(),
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
  action: z
    .enum(["leetcodesearch", "run_tests", "final", "failed"])
    .describe(
      "leetcodesearch fetches a problem and needs arguments.query. run_tests runs the solution already loaded on the server and takes no arguments. final or failed ends the turn and needs answer.",
    ),
  reason: z.string(),
  arguments: z
    .object({
      query: z
        .string()
        .optional()
        .describe(
          "LeetCode problem slug: lowercase words joined by hyphens, as in the problem URL. Example: 'two-sum', 'longest-substring-without-repeating-characters'",
        ),
    })
    .optional()
    .describe("Required for leetcodesearch. Omit for run_tests."),
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

  return leetcodeSearch(decision.arguments.query, "typescript");
};
