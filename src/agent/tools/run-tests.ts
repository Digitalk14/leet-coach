import ts from "typescript";
import vm from "node:vm";

type TestResult = { input: unknown[]; output?: unknown; error?: string };

export const runTests = (
  code: string,
  functionName: string,
  tests: unknown[][],
): TestResult[] => {
  const js = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const ctx = vm.createContext({});
  try {
    vm.runInContext(js, ctx, { timeout: 1000 });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return tests.map((input) => ({ input, error }));
  }
  const results: TestResult[] = [];
  for (const input of tests) {
    try {
      const output = vm.runInContext(
        `${functionName}(...${JSON.stringify(input)})`,
        ctx,
        { timeout: 1000 },
      );
      results.push({ input, output });
    } catch (e) {
      results.push({
        input,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
};
