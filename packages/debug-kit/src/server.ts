import http from "node:http";
import type { AddressInfo } from "node:net";
import { AgentTraceRecorder } from "./recorder";

type DebugServerOptions = {
  port?: number;
  host?: string;
  sessionId?: string;
};

type DebugServer = {
  observer: AgentTraceRecorder["observe"];
  recorder: AgentTraceRecorder;
  url: string;
  close: () => Promise<void>;
};

const DEFAULT_PORT = 5174;
const DEFAULT_HOST = "127.0.0.1";

const writeJson = (
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown,
) => {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
};

export async function createDebugServer(
  options: DebugServerOptions = {},
): Promise<DebugServer> {
  const sessionId =
    options.sessionId ?? `session-${Date.now().toString(36)}`;
  const recorder = new AgentTraceRecorder(sessionId);

  const server = http.createServer((request, response) => {
    if (!request.url) {
      writeJson(response, 404, { error: "Not found" });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/session") {
      writeJson(response, 200, recorder.getSnapshot());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/events") {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
      });

      for (const event of recorder.getSnapshot().events) {
        response.write(`event: trace\ndata: ${JSON.stringify(event)}\n\n`);
      }

      const unsubscribe = recorder.subscribe((event) => {
        response.write(`event: trace\ndata: ${JSON.stringify(event)}\n\n`);
      });

      request.on("close", unsubscribe);
      return;
    }

    writeJson(response, 404, { error: "Not found" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? DEFAULT_PORT, options.host ?? DEFAULT_HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const url = `http://${options.host ?? DEFAULT_HOST}:${address.port}`;

  return {
    observer: recorder.observe,
    recorder,
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
