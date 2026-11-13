import { z } from "zod";
import { leetcodeSearch } from "../tools";

const searchDecision = z.object({
  action: z.literal("leetcodesearch"),
  reason: z.string(),
  arguments: z.object({
    query: z.string(),
  }),
});

const answerDecision = z.object({
  action: z.enum(["final", "failed"]),
  reason: z.string(),
  answer: z.string(),
});

export const DecisionSchema = z.discriminatedUnion("action", [searchDecision, answerDecision]);

/** Flat object schema for the API. A discriminated union has no root `type`, which Anthropic rejects. */
export const DecisionToolSchema = z.object({
  action: z.enum(["leetcodesearch", "final", "failed"]),
  reason: z.string(),
  arguments: z
    .object({ query: z.string() })
    .optional()
    .describe("Required when action is leetcodesearch"),
  answer: z.string().optional().describe("Required when action is final or failed"),
});

type Decision = z.infer<typeof DecisionSchema>;

export const executeTool = async (decision: Decision) => {
  if (decision.action !== "leetcodesearch") {
    throw new Error("Invalid action");
  }

  const result = await leetcodeSearch(decision.arguments.query);
  return result;
};
