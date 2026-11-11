"use client";
import { useState } from "react";
import { runAgentAction } from "@/agent/actions";
import { Markdown } from "@/components/markdown";
import { type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SDKResultMessage | null>(null);
  const handleSubmit = async () => {
    const resultMessage = await runAgentAction(input);
    console.log(resultMessage);
    if (resultMessage) {
      setResult(resultMessage);
    }
  };
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-stretch gap-10 bg-white px-6 py-16 dark:bg-black sm:px-16">
        <div className="flex w-full gap-4">
          <input type="text" placeholder="Enter the task" className="flex-1" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="bg-blue-500 text-white px-4 py-2 rounded-md" onClick={handleSubmit}>Submit</button>
        </div>
        <div className="flex w-full flex-col gap-4">
          <h2 className="text-2xl font-bold">Result</h2>
          {result?.type === "result" && (
            <div className="flex w-full flex-col gap-4">
              <p className="text-sm text-zinc-500">
                {result.duration_ms} ms · ${result.total_cost_usd.toFixed(4)}
              </p>
              {result.subtype === "success" ? (
                <Markdown>{result.result}</Markdown>
              ) : (
                <p className="text-red-600">{result.errors.join("\n")}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
