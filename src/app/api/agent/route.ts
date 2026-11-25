import { runAgent, type AgentEvent } from "@/agent/core/run-agent";

export async function POST(req: Request) {
  const { sessionId, messages, code, problem } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent | { type: "error"; message: string }) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

      try {
        const result = await runAgent({
          sessionId,
          messages,
          code,
          problem,
          onEvent: send,
        });
        send({ type: "done", result } as any);
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "unknown",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
