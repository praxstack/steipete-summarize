import {
  type AgentAssistantMessage as AssistantMessage,
  type AgentMessage as Message,
  type AgentTool as Tool,
  type AgentToolCall as ToolCall,
  parseSseStream,
} from "@steipete/summarize-core/runtime";
import { providerLabel, type DirectModelConfig } from "./config";

export type DirectStreamEvent =
  | { type: "text"; text: string }
  | { type: "assistant"; assistant: AssistantMessage };

export type ProviderStreamOptions = {
  config: DirectModelConfig;
  system: string;
  messages: Message[];
  tools: Tool[];
  maxTokens: number;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
};

function emptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

export function assistantMessage(
  config: DirectModelConfig,
  text: string,
  toolCalls: ToolCall[],
): AssistantMessage {
  return {
    role: "assistant",
    content: [...(text ? [{ type: "text" as const, text }] : []), ...toolCalls],
    timestamp: Date.now(),
    api:
      config.provider === "anthropic"
        ? "anthropic-messages"
        : config.provider === "google"
          ? "google-generative-ai"
          : "openai-completions",
    provider: config.provider,
    model: config.model,
    usage: emptyUsage(),
    stopReason: toolCalls.length > 0 ? "toolUse" : "stop",
  } as AssistantMessage;
}

export function safeJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function* parseSse(
  response: Response,
): AsyncGenerator<{ event: string; data: string }> {
  if (!response.body) throw new Error("Provider returned no response body.");
  for await (const message of parseSseStream(response.body)) {
    if (message.event !== "__comment__") yield message;
  }
}

export function messageText(message: Message): string {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export async function providerHttpError(
  response: Response,
  config: DirectModelConfig,
): Promise<Error> {
  const raw = await response.text().catch(() => "");
  let detail = raw.trim();
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string } | string;
      message?: string;
    };
    detail =
      typeof parsed.error === "string"
        ? parsed.error
        : parsed.error?.message || parsed.message || detail;
  } catch {
    // Keep plain-text provider response.
  }
  const suffix = detail ? `: ${detail.slice(0, 600)}` : "";
  return new Error(`${providerLabel(config.provider)} API error (${response.status})${suffix}`);
}
