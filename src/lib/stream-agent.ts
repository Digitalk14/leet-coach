import type { AgentInput, AgentResult, Usage } from "@/agent/core/run-agent";

export type AgentStreamEvent =
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: unknown; isError?: boolean }
  | { type: "final"; text: string; usage: Usage }
  | { type: "done"; result: AgentResult }
  | { type: "error"; message: string };

export async function streamAgent(
  body: Omit<AgentInput, "onEvent">,
  onEvent: (event: AgentStreamEvent) => void,
) {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    onEvent({ type: "error", message: `HTTP ${res.status}` });
    return;
  }

  if (!res.body) {
    onEvent({ type: "error", message: `HTTP ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        onEvent(JSON.parse(line) as AgentStreamEvent);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) onEvent(JSON.parse(buffer) as AgentStreamEvent);
  } finally {
    reader.releaseLock();
  }
}
