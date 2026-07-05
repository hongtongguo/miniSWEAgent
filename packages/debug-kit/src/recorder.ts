import type { AgentTraceEvent, AgentTraceObserver, AgentTraceSnapshot } from "./types";

type Listener = (event: AgentTraceEvent) => void;

export class AgentTraceRecorder {
  private readonly events: AgentTraceEvent[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(private readonly sessionId: string) {}

  observe: AgentTraceObserver = (event) => {
    this.events.push(event);

    for (const listener of this.listeners) {
      listener(event);
    }
  };

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AgentTraceSnapshot {
    return {
      sessionId: this.sessionId,
      events: [...this.events],
    };
  }
}
