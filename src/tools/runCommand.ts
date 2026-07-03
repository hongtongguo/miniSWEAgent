import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type RunCommandOptions = {
  command: string;
  cwd?: string;
  rootDir?: string;
  timeoutMs?: number;
  maxBuffer?: number;
};

export type RunCommandResult = {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER = 1024 * 1024;

const normalizeLimit = (value: number | undefined, fallback: number) => {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
};

const isInsideRoot = (rootDir: string, target: string) => {
  const relativePath = path.relative(rootDir, target);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
};

export const runCommandToolDefinition = {
  type: "function",
  function: {
    name: "run_command",
    description:
      "Run a shell command in the workspace and return stdout, stderr, and exit status.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute.",
        },
        cwd: {
          type: "string",
          description:
            "Working directory relative to the current workspace. Defaults to the workspace root.",
        },
        timeoutMs: {
          type: "number",
          description: "Command timeout in milliseconds. Defaults to 30000.",
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
} as const;

export const runCommand = async (
  options: RunCommandOptions,
): Promise<RunCommandResult> => {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const cwd = path.resolve(rootDir, options.cwd ?? ".");

  if (!isInsideRoot(rootDir, cwd)) {
    throw new Error(`Working directory is outside the workspace root: ${options.cwd}`);
  }

  try {
    const { stdout, stderr } = await execAsync(options.command, {
      cwd,
      timeout: normalizeLimit(options.timeoutMs, DEFAULT_TIMEOUT_MS),
      maxBuffer: normalizeLimit(options.maxBuffer, DEFAULT_MAX_BUFFER),
      windowsHide: true,
    });

    return {
      command: options.command,
      cwd: path.relative(rootDir, cwd) || ".",
      exitCode: 0,
      stdout,
      stderr,
      timedOut: false,
    };
  } catch (caughtError) {
    const error = caughtError as {
      code?: number | string;
      killed?: boolean;
      signal?: NodeJS.Signals;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    return {
      command: options.command,
      cwd: path.relative(rootDir, cwd) || ".",
      exitCode: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message ?? "",
      timedOut: Boolean(error.killed && error.signal === "SIGTERM"),
    };
  }
};

export default {
  definition: runCommandToolDefinition,
  execute: runCommand,
};
