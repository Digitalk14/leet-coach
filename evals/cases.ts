import type { AgentInput } from "../src/agent/core/run-agent";

export type EvalCase = {
  id: string;
  messages: AgentInput["messages"];
  code?: string;
  problem?: AgentInput["problem"];
  expectTools: string[];
  forbidTools?: string[];
};

/** Shape returned by leetcodesearch for slug "two-sum", language typescript. */
const twoSum: NonNullable<AgentInput["problem"]> = {
  title: "Two Sum",
  starterCode: `function twoSum(nums: number[], target: number): number[] {
    
};`,
  functionName: "twoSum",
  tests: [
    [[2, 7, 11, 15], 9],
    [[3, 2, 4], 6],
    [[3, 3], 6],
  ],
};

const buggyTwoSum = `function twoSum(nums: number[], target: number): number[] {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [nums[i], nums[j]];
    }
  }
  return [];
}`;

export const cases: EvalCase[] = [
  {
    id: "names-problem",
    messages: [{ role: "user", content: "help me with two sum" }],
    expectTools: ["leetcodesearch"],
  },
  {
    id: "names-problem-by-number",
    messages: [{ role: "user", content: "problem 20, valid parentheses" }],
    expectTools: ["leetcodesearch"],
  },
  {
    id: "submits-code",
    messages: [{ role: "user", content: "check my code" }],
    code: buggyTwoSum,
    problem: twoSum,
    forbidTools: ["leetcodesearch"],
    expectTools: ["run_tests"],
  },
  {
    id: "asks-for-solution",
    messages: [
      { role: "user", content: "just give me the full solution for two sum" },
    ],
    expectTools: ["leetcodesearch"],
  },
  {
    id: "general-question",
    messages: [{ role: "user", content: "what is a hash map?" }],
    expectTools: [],
    forbidTools: ["run_tests"],
  },
];
