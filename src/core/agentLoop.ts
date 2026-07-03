import type {
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";

import client from "./oaiClient";
import AgentState from "./state";
import { DEFAULT_MODEL } from "../constant";
import { executeTool, tools } from "../tools/toolRegistry";

const systemPrompt =
  "你是一个Software Engineer, 你将帮助我完成软件开发任务。请根据我的需求，提供详细的解决方案和代码示例。";

const defaultAgentState = new AgentState({
  systemPrompt,
});

const toToolContent = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }

  return JSON.stringify(payload, null, 2);
};

async function toolCallHandler(
  toolCall: ChatCompletionMessageToolCall,
): Promise<string> {
  if (toolCall.type !== "function") {
    return toToolContent({
      ok: false,
      error: `Unsupported tool call type: ${toolCall.type}`,
    });
  }

  const { name, arguments: rawArguments } = toolCall.function;

  try {
    const args =
      rawArguments.trim().length > 0
        ? (JSON.parse(rawArguments) as Record<string, unknown>)
        : {};
    const result = await executeTool(name, args);

    return toToolContent({
      ok: true,
      ...result,
    });
  } catch (caughtError) {
    return toToolContent({
      ok: false,
      toolName: name,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown tool execution error",
    });
  }
}

export function createAgentState(): AgentState {
  return new AgentState({
    systemPrompt,
  });
}

async function agentLoop(
  userInput: string,
  state: AgentState = defaultAgentState,
): Promise<string> {
  state.addUserMessage(userInput);

  while (true) {
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: state.getMessagesForRequest(),
      tools,
      tool_choice: "auto",
    });
    const res = completion.choices[0];
    if (res.finish_reason === "stop" || res.message.tool_calls?.length === 0) {
      const content = res.message.content ?? "";
      state.addAssistantMessage({
        content,
      });
      return content;
    }
    switch (res.finish_reason) {
      case "content_filter":
      case "length":
        state.addAssistantMessage({
          content: res.message.content,
        });
        break;
      case "tool_calls":
        state.addAssistantMessage({
          content: res.message.content,
          tool_calls: res.message.tool_calls,
        });

        for (const toolCall of res.message.tool_calls || []) {
          const toolResult = await toolCallHandler(toolCall);
          state.addToolMessage(toolCall.id, toolResult);
        }
        break;

      case "function_call":
        const functionCall = res.message.function_call;
        if (!functionCall) {
          break;
        }
        // Handle function calls here
        console.log("Function call received:", functionCall);
        // You can add logic to execute the function and return the result
        const functionResult = "Function execution result";
        state.addFunctionMessage(functionCall.name, functionResult);
        break;
      default:
        throw new Error(`Unknown finish reason: ${res.finish_reason}`);
    }
  }
  // return aiResponse;
}

export default agentLoop;
