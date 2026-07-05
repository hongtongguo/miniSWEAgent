import type {
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import type { AgentTurnTracer } from "@mini-swe-agent/debug-kit";

type ToolCallHandler = (
  toolCall: ChatCompletionMessageToolCall,
) => Promise<string>;

export function createTracedToolCallHandler(
  toolCallHandler: ToolCallHandler,
  tracer: AgentTurnTracer,
): ToolCallHandler {
  return async (toolCall) => {
    await tracer.emit("tool.started", {
      toolCall,
    });

    const result = await toolCallHandler(toolCall);

    await tracer.emit("tool.finished", {
      toolCallId: toolCall.id,
      result,
    });

    return result;
  };
}
