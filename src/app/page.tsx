"use client";
import { useEffect, useRef, useState } from "react";
import { runAgentAction } from "@/agent/actions";
import { Markdown } from "@/components/markdown";
import Anthropic from "@anthropic-ai/sdk";

function messageText(content: Anthropic.MessageParam["content"]) {
  if (typeof content === "string") return content;
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n\n");
}

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Anthropic.MessageParam[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const next = [...messages, { role: "user", content: trimmed } as const];
    setMessages(next);
    setInput("");
    try {
      const { messages: newMessages } = await runAgentAction({ messages: next });
      setMessages(newMessages);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setMessages([...next, { role: "assistant", content: message }]);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-white font-sans dark:bg-black">
      <main className="relative mx-auto flex h-full w-full max-w-3xl flex-col">
        <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-6 pb-28">
          {messages.map((message, index) => {
            const text = messageText(message.content);
            if (!text) return null;
            const isUser = message.role === "user";
            return (
              <div key={index} className={isUser ? "ml-auto w-fit max-w-[75%]" : "w-full"}>
                <div
                  className={
                    isUser
                      ? "rounded-3xl bg-[#eef2f6] px-4 py-2.5 dark:bg-zinc-800 [&_p:last-child]:mb-0"
                      : "[&_p:last-child]:mb-0"
                  }
                >
                  <Markdown>{text}</Markdown>
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-white from-60% to-transparent px-4 pt-8 pb-4 dark:from-black">
          <div className="flex w-full items-center gap-3">
            <input
              type="text"
              placeholder="Enter the task"
              className="h-11 flex-1 rounded-full border border-zinc-200 bg-white px-4 outline-none dark:border-zinc-700 dark:bg-zinc-900"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
            <button className="h-11 shrink-0 rounded-full bg-blue-500 px-5 text-white" onClick={handleSubmit}>
              Submit
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
