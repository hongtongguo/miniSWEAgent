import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  PlugZap,
  Radio,
  RefreshCw,
  Send,
  Wrench,
} from "lucide-react";
import type { AgentTraceEvent, AgentTraceSnapshot } from "../../src";
import "./styles.css";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

const DEFAULT_TRACE_URL = "http://127.0.0.1:5174";
const traceUrlStorageKey = "mini-swe-agent-debug-url";

const getEventTitle = (event: AgentTraceEvent): string => {
  switch (event.type) {
    case "turn.started":
      return "Turn started";
    case "model.request":
      return "Model request";
    case "model.response":
      return "Model response";
    case "tool.started":
      return "Tool started";
    case "tool.finished":
      return "Tool finished";
    case "turn.finished":
      return "Turn finished";
    case "turn.failed":
      return "Turn failed";
  }
};

const getEventIcon = (event: AgentTraceEvent) => {
  switch (event.type) {
    case "model.request":
      return Send;
    case "model.response":
      return Radio;
    case "tool.started":
    case "tool.finished":
      return Wrench;
    case "turn.failed":
      return CircleAlert;
    case "turn.finished":
      return CheckCircle2;
    default:
      return Activity;
  }
};

const getPayloadSummary = (event: AgentTraceEvent): string => {
  if (!event.payload || typeof event.payload !== "object") {
    return String(event.payload ?? "");
  }

  const payload = event.payload as Record<string, unknown>;

  if (event.type === "model.request") {
    const messages = Array.isArray(payload.messages) ? payload.messages.length : 0;
    return `${payload.model ?? "model"} · ${messages} messages`;
  }

  if (event.type === "model.response") {
    return String(payload.finishReason ?? "response");
  }

  if (event.type === "tool.started") {
    const toolCall = payload.toolCall as { function?: { name?: string } } | undefined;
    return toolCall?.function?.name ?? "tool";
  }

  if (event.type === "tool.finished") {
    return String(payload.toolCallId ?? "tool result");
  }

  if (event.type === "turn.started") {
    return String(payload.userInput ?? "");
  }

  if (event.type === "turn.failed") {
    return String(payload.error ?? "error");
  }

  return "";
};

const formatTime = (timestamp: string): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));

function App() {
  const [traceUrl, setTraceUrl] = useState(
    () => localStorage.getItem(traceUrlStorageKey) ?? DEFAULT_TRACE_URL,
  );
  const [events, setEvents] = useState<AgentTraceEvent[]>([]);
  const [selectedTurnId, setSelectedTurnId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  useEffect(() => {
    localStorage.setItem(traceUrlStorageKey, traceUrl);
  }, [traceUrl]);

  useEffect(() => {
    setConnectionState("connecting");

    let source: EventSource | undefined;
    let cancelled = false;

    fetch(`${traceUrl}/api/session`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<AgentTraceSnapshot>;
      })
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setEvents(snapshot.events);
        setSelectedTurnId((current) => current || snapshot.events.at(-1)?.turnId || "");
        setSelectedEventId((current) => current || snapshot.events.at(-1)?.id || "");
        source = new EventSource(`${traceUrl}/api/events`);
        source.addEventListener("trace", (message) => {
          const event = JSON.parse(message.data) as AgentTraceEvent;
          setEvents((currentEvents) =>
            currentEvents.some((currentEvent) => currentEvent.id === event.id)
              ? currentEvents
              : [...currentEvents, event],
          );
          setSelectedTurnId((current) => current || event.turnId);
          setSelectedEventId((current) => current || event.id);
        });
        source.onopen = () => setConnectionState("connected");
        source.onerror = () => setConnectionState("error");
      })
      .catch(() => {
        if (!cancelled) {
          setConnectionState("error");
        }
      });

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [traceUrl]);

  const turns = useMemo(() => {
    const grouped = new Map<string, AgentTraceEvent[]>();
    for (const event of events) {
      grouped.set(event.turnId, [...(grouped.get(event.turnId) ?? []), event]);
    }
    return [...grouped.entries()].map(([turnId, turnEvents]) => ({
      turnId,
      events: turnEvents,
      title: getPayloadSummary(turnEvents[0]) || turnId.slice(0, 8),
    }));
  }, [events]);

  const selectedTurn = useMemo(
    () => turns.find((turn) => turn.turnId === selectedTurnId) ?? turns.at(-1),
    [selectedTurnId, turns],
  );

  const selectedEvent = useMemo(
    () =>
      events.find((event) => event.id === selectedEventId) ??
      selectedTurn?.events.at(-1) ??
      events.at(-1),
    [events, selectedEventId, selectedTurn],
  );

  const eventPayload = selectedEvent
    ? JSON.stringify(selectedEvent.payload, null, 2)
    : "{}";

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>miniSWEAgent Debug</h1>
          <p>{events.length} events</p>
        </div>
        <div className="connection">
          <PlugZap size={18} />
          <input
            aria-label="Trace server URL"
            value={traceUrl}
            onChange={(event) => setTraceUrl(event.target.value)}
          />
          <span className={`status status-${connectionState}`}>
            {connectionState}
          </span>
          <button
            aria-label="Reconnect"
            title="Reconnect"
            onClick={() => setTraceUrl((current) => current.trim())}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="turns">
          <div className="panel-heading">Turns</div>
          {turns.map((turn, index) => (
            <button
              className={`turn ${turn.turnId === selectedTurn?.turnId ? "selected" : ""}`}
              key={turn.turnId}
              onClick={() => {
                setSelectedTurnId(turn.turnId);
                setSelectedEventId(turn.events.at(-1)?.id ?? "");
              }}
            >
              <span>#{index + 1}</span>
              <strong>{turn.title}</strong>
              <small>{turn.events.length} events</small>
            </button>
          ))}
        </aside>

        <section className="timeline">
          <div className="panel-heading">Timeline</div>
          {selectedTurn?.events.map((event) => {
            const Icon = getEventIcon(event);
            return (
              <button
                className={`event ${event.id === selectedEvent?.id ? "selected" : ""}`}
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
              >
                <span className="event-icon">
                  <Icon size={18} />
                </span>
                <span className="event-main">
                  <strong>{getEventTitle(event)}</strong>
                  <small>{getPayloadSummary(event)}</small>
                </span>
                <time>{formatTime(event.timestamp)}</time>
              </button>
            );
          })}
        </section>

        <section className="inspector">
          <div className="panel-heading">
            <span>Payload</span>
            {selectedEvent ? <code>{selectedEvent.type}</code> : null}
          </div>
          <pre>{eventPayload}</pre>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
