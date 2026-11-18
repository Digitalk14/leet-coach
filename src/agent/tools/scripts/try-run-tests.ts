import { runTests } from "../run-tests";

const code = `function twoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const prev = seen.get(target - nums[i]);
    if (prev !== undefined) return [prev, undefined as any];
    seen.set(nums[i], i);
  }
  return [];
}`;

const tests = [[[2, 7, 11, 15], 9], [[3, 2, 4], 6], [[3, 3], 6]];
console.log(JSON.stringify(runTests(code, "twoSum", tests), null, 2));