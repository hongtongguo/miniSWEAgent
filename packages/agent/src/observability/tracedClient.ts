import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import type { AgentTurnTracer } from "@mini-swe-agent/debug-kit";
import type client from "../core/oaiClient";

type OpenAIClient = typeof client;

export function createTracedChatCompletions(
  openaiClient: OpenAIClient,
  tracer: AgentTurnTracer,
) {
  return {
    async create(
      params: ChatCompletionCreateParamsNonStreaming,
    ): Promise<ChatCompletion> {
      await tracer.emit("model.request", {
        model: params.model,
        messages: params.messages,
        toolCount: params.tools?.length ?? 0,
      });

      const completion = await openaiClient.chat.completions.create(params);
      const response = completion.choices[0];

      await tracer.emit("model.response", {
        finishReason: response?.finish_reason,
        message: response?.message,
        usage: completion.usage,
      });

      return completion;
    },
  };
}
