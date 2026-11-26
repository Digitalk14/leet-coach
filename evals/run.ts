import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { cases, type EvalCase } from "./cases";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env.local") });

const { runAgent } = await import("../src/agent/core/run-agent.ts");

const TOOLS = new Set(["leetcodesearch", "run_tests"]);

const calledTools = (steps: { action: string }[]) =>
  steps.map((step) => step.action).filter((action) => TOOLS.has(action));

const passed = (evalCase: EvalCase, called: string[]) => {
  const used = new Set(called);
  const expected = evalCase.expectTools.every((name) => used.has(name));
  const forbidden = (evalCase.forbidTools ?? []).some((name) => used.has(name));
  return expected && !forbidden;
};

const money = (usd: number) => `$${usd.toFixed(4)}`;

type Row = {
  id: string;
  result: "pass" | "fail";
  tools: string;
  cost: string;
  error?: string;
};

const rows: Row[] = [];

for (const evalCase of cases) {
  const sessionId = `eval-${evalCase.id}-${Date.now()}`;
  try {
    const result = await runAgent({
      sessionId,
      messages: evalCase.messages,
      code: evalCase.code,
      problem: evalCase.problem,
    });
    const called = calledTools(result.steps);
    rows.push({
      id: evalCase.id,
      result: passed(evalCase, called) ? "pass" : "fail",
      tools: called.join(", ") || "—",
      cost: money(result.usage.costUsd),
    });
  } catch (error) {
    rows.push({
      id: evalCase.id,
      result: "fail",
      tools: "—",
      cost: money(0),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const idWidth = Math.max(2, ...rows.map((row) => row.id.length));
const toolWidth = Math.max(5, ...rows.map((row) => row.tools.length));
const header = `${"id".padEnd(idWidth)} | result | ${"tools".padEnd(toolWidth)} | cost`;
console.log(header);
console.log("-".repeat(header.length));
for (const row of rows) {
  console.log(
    `${row.id.padEnd(idWidth)} | ${row.result.padEnd(6)} | ${row.tools.padEnd(toolWidth)} | ${row.cost}`,
  );
  if (row.error) console.log(`  error: ${row.error}`);
}

const passCount = rows.filter((row) => row.result === "pass").length;
const totalCost = rows.reduce((sum, row) => sum + Number(row.cost.slice(1)), 0);
console.log(
  `\n${passCount}/${rows.length} passed, total cost ${money(totalCost)}`,
);

if (passCount !== rows.length) process.exit(1);
