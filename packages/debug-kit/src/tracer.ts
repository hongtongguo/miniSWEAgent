import { randomUUID } from "node:crypto";
import type { AgentTraceEvent, AgentTraceObserver } from "./types";

export type AgentTracerOptions = {
  observer?: AgentTraceObserver;
  sessionId?: string;
};

export class AgentTurnTracer {
  private sequence = 0;

  constructor(
    private readonly options: AgentTracerOptions,
    private readonly turnId: string,
  ) {}

  async emit(type: AgentTraceEvent["type"], payload: unknown): Promise<void> {
    if (!this.options.observer) {
      return;
    }

    this.sequence += 1;
    await this.options.observer({
      id: randomUUID(),
      sessionId: this.options.sessionId ?? "default",
      turnId: this.turnId,
      sequence: this.sequence,
      type,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  async start(userInput: string): Promise<void> {
    await this.emit("turn.started", {
      userInput,
    });
  }

  async finish(content: string): Promise<void> {
    await this.emit("turn.finished", {
      content,
    });
  }

  async fail(caughtError: unknown): Promise<void> {
    await this.emit("turn.failed", {
      error:
        caughtError instanceof Error ? caughtError.message : "Unknown error",
    });
  }
}

export function createAgentTurnTracer(
  options: AgentTracerOptions = {},
): AgentTurnTracer {
  return new AgentTurnTracer(options, randomUUID());
}
