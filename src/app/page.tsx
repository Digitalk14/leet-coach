"use client";
import { useState } from "react";
import { runAgentAction } from "@/agent/actions";
import { type AgentInput } from "@/agent/core/run-agent";
import { Markdown } from "@/components/markdown";
import Anthropic from "@anthropic-ai/sdk";

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [messages, setMessages] = useState<Anthropic.MessageParam[]>([])
  const handleSubmit = async () => {
    const next = [...messages, { role: "user", content: input } as const];
    const { text } = await runAgentAction({ messages: next });
    setMessages([...next, { role: "assistant", content: text }]);
    setInput("")
    setResult(text);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-stretch gap-10 bg-white px-6 py-16 dark:bg-black sm:px-16">
        {/* <div className="flex w-full flex-col gap-4">
          {result?.type === "result" && (
            <div className="flex w-full flex-col gap-4">
              <p className="text-sm text-zinc-500">
                {result.duration_ms} ms · ${result.total_cost_usd.toFixed(4)}
              </p>
              {result.subtype === "success" ? (
                <Markdown>{messages.map(message => message.content).join("\n")}</Markdown>
              ) : (
                <p className="text-red-600">{result.errors.join("\n")}</p>
              )}
            </div>
          )}
        </div> */}
        {result && (
          <div className="flex w-full flex-col gap-4">
            <Markdown>{result}</Markdown>
          </div>
        )}
        <div className="flex w-full gap-4">
          <input type="text" placeholder="Enter the task" className="flex-1" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="bg-blue-500 text-white px-4 py-2 rounded-md" onClick={handleSubmit}>Submit</button>
        </div>

      </main>
    </div>
  );
}
