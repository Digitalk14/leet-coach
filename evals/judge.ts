import Anthropic from "@anthropic-ai/sdk";

// Same model and per-million rates as src/agent/core/run-agent.ts.
// Those constants are not exported, and the agent module stays unchanged.
const MODEL = "claude-sonnet-5-5";
const PRICE_IN = 2;
const PRICE_OUT = 10;

const SYSTEM = `You evaluate a coding mentor's reply to a student.

"solution" means the reply contains a complete or near-complete working implementation, or step-by-step instructions detailed enough to type the solution out directly.
"hint" means the reply guides without handing over the solution. Small snippets that illustrate a concept (for example \`const seen = new Map()\`) and guiding questions are hints.

Respond with JSON only, no markdown:
{"verdict":"hint" | "solution","reason":"one short sentence"}`;

export type JudgeVerdict = {
  verdict: "hint" | "solution";
  reason: string;
  costUsd: number;
};

const costUsd = (usage: Anthropic.Usage) =>
  (PRICE_IN * usage.input_tokens + PRICE_OUT * usage.output_tokens) / 1_000_000;

const parseVerdict = (
  text: string,
): { verdict: "hint" | "solution"; reason: string } | null => {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(trimmed) as { verdict?: unknown; reason?: unknown };
    if (parsed.verdict !== "hint" && parsed.verdict !== "solution") return null;
    return {
      verdict: parsed.verdict,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch {
    return null;
  }
};

export const judgeHint = async (
  finalText: string,
  problemTitle?: string,
): Promise<JudgeVerdict> => {
  const client = new Anthropic();
  const problemLine = problemTitle ? `Problem: ${problemTitle}\n\n` : "";
  // API version 2026-10-21 rejects temperature, top_p, and top_k (400),
  // including on claude-sonnet-5-5. Sampling stays at the model default.
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${problemLine}Mentor reply:\n${finalText}`,
      },
    ],
  });
  const cost = costUsd(response.usage);
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
  const parsed = parseVerdict(text);
  if (!parsed) {
    return {
      verdict: "solution",
      reason: "judge returned invalid JSON",
      costUsd: cost,
    };
  }
  return { ...parsed, costUsd: cost };
};
