import { z } from "zod";

export const DecisionSchema = z.object({
    action: z.enum(["leetcodesearch", "final", "failed"]),
    reason: z.string(),
    arguments: z.object({
      query: z.string(),
    }),
    answer: z.string(),
  });
  
  type Decision = z.infer<typeof DecisionSchema>;

export const executeTool = async (decision: Decision) => {
}