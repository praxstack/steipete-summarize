export type AgentTextContent = {
  type: "text";
  text: string;
  textSignature?: string;
};

export type AgentThinkingContent = {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
};

export type AgentImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type AgentToolCall = {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  thoughtSignature?: string;
};

export type AgentUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
};

export type AgentUserMessage = {
  role: "user";
  content: string | Array<AgentTextContent | AgentImageContent>;
  timestamp: number;
};

export type AgentAssistantMessage = {
  role: "assistant";
  content: Array<AgentTextContent | AgentThinkingContent | AgentToolCall>;
  api: string;
  provider: string;
  model: string;
  responseModel?: string;
  responseId?: string;
  usage: AgentUsage;
  stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
  errorMessage?: string;
  timestamp: number;
};

export type AgentToolResultMessage<TDetails = unknown> = {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: Array<AgentTextContent | AgentImageContent>;
  details?: TDetails;
  isError: boolean;
  timestamp: number;
};

export type AgentMessage = AgentUserMessage | AgentAssistantMessage | AgentToolResultMessage;

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};
