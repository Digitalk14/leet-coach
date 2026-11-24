export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");
  new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        shouldExportSpan: ({ otelSpan }) =>
          otelSpan.instrumentationScope.name !== "com.anthropic.sdk.typescript",
      }),
    ],
  }).start();
}
