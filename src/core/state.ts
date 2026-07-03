import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionFunctionMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import {
  DEFAULT_MODEL,
  DEFAULT_RESERVED_OUTPUT_TOKENS,
  MODEL_CONTEXT_LIMITS,
} from "../constant";

type AgentStateOptions = {
  systemPrompt: string;
  maxContextTokens?: number;
  reservedOutputTokens?: number;
  recentMessageGroups?: number;
  maxToolContentChars?: number;
};

type AssistantMessageInput = {
  content?: string | null;
  tool_calls?: ChatCompletionMessageToolCall[];
};

type ContextStats = {
  messageCount: number;
  estimatedTokens: number;
  maxPromptTokens: number;
  compacted: boolean;
};

const DEFAULT_MAX_CONTEXT_TOKENS =
  MODEL_CONTEXT_LIMITS[DEFAULT_MODEL] ?? 1_000_000;
const DEFAULT_RECENT_MESSAGE_GROUPS = 12;
const DEFAULT_MAX_TOOL_CONTENT_CHARS = 20_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

const estimateTokens = (value: unknown): number => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil((text?.length ?? 0) / CHARS_PER_TOKEN_ESTIMATE);
};

const messageToText = (message: ChatCompletionMessageParam): string => {
  const content = "content" in message ? message.content : undefined;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return JSON.stringify(content);
  }
  return "";
};

const truncateMiddle = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) {
    return text;
  }

  const marker = "\n\n[... truncated for context window ...]\n\n";
  const keepChars = Math.max(0, maxChars - marker.length);
  const headChars = Math.ceil(keepChars * 0.65);
  const tailChars = keepChars - headChars;

  return `${text.slice(0, headChars)}${marker}${text.slice(text.length - tailChars)}`;
};

const cloneForRequest = (
  message: ChatCompletionMessageParam,
  maxToolContentChars: number,
): ChatCompletionMessageParam => {
  if (message.role !== "tool" || typeof message.content !== "string") {
    return message;
  }

  return {
    ...message,
    content: truncateMiddle(message.content, maxToolContentChars),
  };
};

type MessageGroup = {
  messages: ChatCompletionMessageParam[];
  hasToolCall: boolean;
};

const isToolMessage = (
  message: ChatCompletionMessageParam,
): message is Extract<ChatCompletionMessageParam, { role: "tool" }> =>
  message.role === "tool";

const groupMessages = (
  messages: ChatCompletionMessageParam[],
): MessageGroup[] => {
  const groups: MessageGroup[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (
      message.role === "assistant" &&
      "tool_calls" in message &&
      message.tool_calls?.length
    ) {
      const groupMessagesForToolCall: ChatCompletionMessageParam[] = [message];
      const expectedToolCallIds = new Set(
        message.tool_calls.map((toolCall) => toolCall.id),
      );

      while (index + 1 < messages.length) {
        const nextMessage = messages[index + 1];
        if (
          !isToolMessage(nextMessage) ||
          !expectedToolCallIds.has(nextMessage.tool_call_id)
        ) {
          break;
        }

        index += 1;
        groupMessagesForToolCall.push(messages[index]);
      }

      groups.push({
        messages: groupMessagesForToolCall,
        hasToolCall: true,
      });
      continue;
    }

    groups.push({
      messages: [message],
      hasToolCall: false,
    });
  }

  return groups;
};

export class AgentState {
  private readonly systemPrompt: string;
  private readonly maxContextTokens: number;
  private readonly reservedOutputTokens: number;
  private readonly recentMessageGroups: number;
  private readonly maxToolContentChars: number;
  private readonly messages: ChatCompletionMessageParam[];

  constructor(options: AgentStateOptions) {
    this.systemPrompt = options.systemPrompt;
    this.maxContextTokens =
      options.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
    this.reservedOutputTokens =
      options.reservedOutputTokens ?? DEFAULT_RESERVED_OUTPUT_TOKENS;
    this.recentMessageGroups =
      options.recentMessageGroups ?? DEFAULT_RECENT_MESSAGE_GROUPS;
    this.maxToolContentChars =
      options.maxToolContentChars ?? DEFAULT_MAX_TOOL_CONTENT_CHARS;
    this.messages = [
      {
        role: "system",
        content: this.systemPrompt,
      },
    ];
  }

  addUserMessage(content: string): void {
    this.messages.push({
      role: "user",
      content,
    });
  }

  addAssistantMessage(message: AssistantMessageInput): void {
    const assistantMessage: ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: message.content ?? null,
    };

    if (message.tool_calls?.length) {
      assistantMessage.tool_calls = message.tool_calls;
    }

    this.messages.push(assistantMessage);
  }

  addToolMessage(toolCallId: string, content: string): void {
    this.messages.push({
      role: "tool",
      tool_call_id: toolCallId,
      content,
    });
  }

  addFunctionMessage(name: string, content: string): void {
    const functionMessage: ChatCompletionFunctionMessageParam = {
      role: "function",
      name,
      content,
    };

    this.messages.push(functionMessage);
  }

  getAllMessages(): readonly ChatCompletionMessageParam[] {
    return this.messages;
  }

  getMessagesForRequest(): ChatCompletionMessageParam[] {
    const promptTokenBudget = this.getPromptTokenBudget();
    const requestMessages = this.messages.map((message) =>
      cloneForRequest(message, this.maxToolContentChars),
    );

    if (this.estimateMessagesTokens(requestMessages) <= promptTokenBudget) {
      return requestMessages;
    }

    return this.compactMessages(requestMessages, promptTokenBudget);
  }

  getContextStats(): ContextStats {
    const requestMessages = this.getMessagesForRequest();
    const estimatedTokens = this.estimateMessagesTokens(requestMessages);

    return {
      messageCount: requestMessages.length,
      estimatedTokens,
      maxPromptTokens: this.getPromptTokenBudget(),
      compacted: requestMessages.length !== this.messages.length,
    };
  }

  private getPromptTokenBudget(): number {
    return Math.max(1, this.maxContextTokens - this.reservedOutputTokens);
  }

  private estimateMessagesTokens(messages: ChatCompletionMessageParam[]): number {
    return estimateTokens(messages);
  }

  private compactMessages(
    messages: ChatCompletionMessageParam[],
    promptTokenBudget: number,
  ): ChatCompletionMessageParam[] {
    const [systemMessage, ...conversationMessages] = messages;
    const groups = groupMessages(conversationMessages);
    const keptGroups: MessageGroup[] = [];

    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const nextKeptGroups = [groups[index], ...keptGroups];
      const candidate = this.buildCompactedMessages(
        systemMessage,
        groups.slice(0, index),
        nextKeptGroups,
      );

      const hasEnoughRecentContext =
        nextKeptGroups.length >= this.recentMessageGroups;
      const fitsBudget =
        this.estimateMessagesTokens(candidate) <= promptTokenBudget;

      if (fitsBudget || !hasEnoughRecentContext) {
        keptGroups.unshift(groups[index]);
        continue;
      }

      break;
    }

    let droppedGroupCount = groups.length - keptGroups.length;
    let compacted = this.buildCompactedMessages(
      systemMessage,
      groups.slice(0, droppedGroupCount),
      keptGroups,
    );

    while (
      keptGroups.length > 1 &&
      this.estimateMessagesTokens(compacted) > promptTokenBudget
    ) {
      keptGroups.shift();
      droppedGroupCount += 1;
      compacted = this.buildCompactedMessages(
        systemMessage,
        groups.slice(0, droppedGroupCount),
        keptGroups,
      );
    }

    return compacted;
  }

  private buildCompactedMessages(
    systemMessage: ChatCompletionMessageParam,
    droppedGroups: MessageGroup[],
    keptGroups: MessageGroup[],
  ): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [systemMessage];

    if (droppedGroups.length > 0) {
      messages.push({
        role: "system",
        content: this.summarizeDroppedGroups(droppedGroups),
      });
    }

    for (const group of keptGroups) {
      messages.push(...group.messages);
    }

    return messages;
  }

  private summarizeDroppedGroups(groups: MessageGroup[]): string {
    const lines = [
      "Earlier conversation was compacted to stay within the context window.",
      `Compacted message groups: ${groups.length}.`,
    ];

    const recentDroppedGroups = groups.slice(-8);
    for (const group of recentDroppedGroups) {
      const roles = group.messages.map((message) => message.role).join("+");
      const firstMessage = group.messages[0];
      const snippet = truncateMiddle(
        messageToText(firstMessage).replace(/\s+/g, " ").trim(),
        500,
      );
      lines.push(`- ${roles}${group.hasToolCall ? " with tool call" : ""}: ${snippet}`);
    }

    return lines.join("\n");
  }
}

export default AgentState;
