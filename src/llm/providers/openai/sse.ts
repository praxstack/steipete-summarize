import { parseSseStream } from "@steipete/summarize-core/runtime";
import type { LlmTokenUsage } from "../../types.js";

export async function* parseOpenAiSseJsonStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  for await (const message of parseSseStream(body)) {
    if (message.event === "__comment__") continue;
    const data = message.data.trim();
    if (!data) continue;
    if (data === "[DONE]") return;
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === "object") {
      yield parsed as Record<string, unknown>;
    }
  }
}

export function createDeferredUsage(): {
  promise: Promise<LlmTokenUsage | null>;
  resolve: (value: LlmTokenUsage | null) => void;
} {
  let resolve: (value: LlmTokenUsage | null) => void = () => {};
  const promise = new Promise<LlmTokenUsage | null>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
