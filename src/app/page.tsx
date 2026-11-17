"use client";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { runAgentAction } from "@/agent/actions";
import type { TimelineStep } from "@/agent/core/run-agent";
import { Markdown } from "@/components/markdown";
import { Timeline } from "@/components/timeline";
import Anthropic from "@anthropic-ai/sdk";

type ChatItem = { role: "user" | "assistant"; text: string; steps?: TimelineStep[] };

export default function Home() {
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Anthropic.MessageParam[]>([]);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [chat]);

  const sendMessage = async (text: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const next: Anthropic.MessageParam[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setChat((current) => [...current, { role: "user", text }]);
    try {
      const result = await runAgentAction({ messages: next });
      setMessages(result.messages);
      setChat((current) => [
        ...current,
        { role: "assistant", text: result.text, steps: result.steps },
      ]);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setMessages([...next, { role: "assistant", content: message }]);
      setChat((current) => [...current, { role: "assistant", text: message }]);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    setInput("");
    const result = await sendMessage(trimmed);
    if (result) setCode(result.problem?.starterCode ?? "");
  };

  const handleCodeChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setCode(event.target.value);
  };

  const handleCodeKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const indent = "  ";

    if (event.shiftKey) {
      const lineStart = code.lastIndexOf("\n", start - 1) + 1;
      const line = code.slice(lineStart, end);
      const stripped = line.replace(new RegExp(`^${indent}`), "");
      if (stripped === line) return;
      const next = code.slice(0, lineStart) + stripped + code.slice(end);
      const removed = line.length - stripped.length;
      setCode(next);
      requestAnimationFrame(() => {
        editor.selectionStart = Math.max(lineStart, start - removed);
        editor.selectionEnd = Math.max(lineStart, end - removed);
      });
      return;
    }

    const next = code.slice(0, start) + indent + code.slice(end);
    setCode(next);
    requestAnimationFrame(() => {
      editor.selectionStart = editor.selectionEnd = start + indent.length;
    });
  };

  const handleSubmitSolution = async () => {
    if (pending) return;
    await sendMessage("Here is my solution:\n```ts\n" + code + "\n```");
  };

  return (
    <div className="flex h-dvh flex-col bg-white font-sans dark:bg-black">
      <main className="flex min-h-0 w-full flex-1">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col border-r border-zinc-200 dark:border-zinc-800">
          <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-6 pb-28">
            {chat.map((item, index) => {
              const isUser = item.role === "user";
              return (
                <div key={index} className={isUser ? "ml-auto w-fit max-w-[75%]" : "w-full"}>
                  {!isUser && item.steps?.length ? <Timeline steps={item.steps} /> : null}
                  <div
                    className={
                      isUser
                        ? "rounded-3xl bg-[#eef2f6] px-4 py-2.5 dark:bg-zinc-800 [&_p:last-child]:mb-0"
                        : "[&_p:last-child]:mb-0"
                    }
                  >
                    <Markdown>{item.text}</Markdown>
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
              <button
                className="h-11 shrink-0 rounded-full bg-blue-500 px-5 text-white disabled:opacity-50"
                onClick={handleSubmit}
                disabled={pending}
              >
                Submit
              </button>
            </div>
          </div>
        </section>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center border-b border-zinc-200 px-4 text-sm text-zinc-500 dark:border-zinc-800">
            Code
            <button
              className="ml-auto rounded-md bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
              onClick={handleSubmitSolution}
              disabled={pending}
            >
              Submit solution
            </button>
          </div>
          <textarea
            ref={editorRef}
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleCodeKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Write your solution"
            className="min-h-0 flex-1 resize-none bg-zinc-50 p-4 font-mono text-sm leading-6 outline-none dark:bg-zinc-950"
          />
        </section>
      </main>
    </div>
  );
}
