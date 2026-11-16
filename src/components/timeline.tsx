import type { TimelineStep } from "@/agent/core/run-agent";

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatInput(input: unknown) {
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  const title = steps.map((step) => step.action).join(" → ");

  return (
    <details className="group mb-3 rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm text-zinc-600 marker:content-none dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block text-zinc-400 transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        <span className="shrink-0 font-medium text-zinc-800 dark:text-zinc-100">
          {steps.length} {steps.length === 1 ? "step" : "steps"}
        </span>
        <span className="truncate">{title}</span>
      </summary>
      <ol>
        {steps.map((step, index) => (
          <li
            key={index}
            className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="font-medium">{step.action}</span>
              <span className={step.status === "ok" ? "text-emerald-600" : "text-red-500"}>
                {step.status}
              </span>
              <span className="text-zinc-400">{formatDuration(step.durationMs)}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{step.reason}</p>
            {step.input != null && (
              <pre className="mt-2 overflow-x-auto font-mono text-xs text-zinc-500">
                {formatInput(step.input)}
              </pre>
            )}
            {step.result && (
              <pre className="mt-2 max-h-32 overflow-auto font-mono text-xs whitespace-pre-wrap text-zinc-500">
                {step.result}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}
