export type AgentTraceEventType =
  | "turn.started"
  | "model.request"
  | "model.response"
  | "tool.started"
  | "tool.finished"
  | "turn.finished"
  | "turn.failed";

export type AgentTraceEvent = {
  id: string;
  sessionId: string;
  turnId: string;
  sequence: number;
  type: AgentTraceEventType;
  timestamp: string;
  payload: unknown;
};

export type AgentTraceObserver = (event: AgentTraceEvent) => void | Promise<void>;

export type AgentTraceSnapshot = {
  sessionId: string;
  events: AgentTraceEvent[];
};
