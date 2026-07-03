import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitDiffOptions = {
  rootDir?: string;
  cwd?: string;
  filePath?: string;
  staged?: boolean;
  statOnly?: boolean;
  maxBytes?: number;
};

export type GitDiffResult = {
  rootDir: string;
  cwd: string;
  command: string[];
  diff: string;
  truncated: boolean;
};

const DEFAULT_MAX_BYTES = 512 * 1024;

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

export const gitDiffToolDefinition = {
  type: "function",
  function: {
    name: "git_diff",
    description:
      "Return the current git diff for the workspace, optionally limited to staged changes or a single file.",
    parameters: {
      type: "object",
      properties: {
        cwd: {
          type: "string",
          description:
            "Directory relative to the current workspace where git should run.",
        },
        filePath: {
          type: "string",
          description: "Optional file path to diff, relative to the workspace.",
        },
        staged: {
          type: "boolean",
          description: "Show staged changes instead of unstaged changes.",
        },
        statOnly: {
          type: "boolean",
          description: "Return only diff stats.",
        },
        maxBytes: {
          type: "number",
          description:
            "Maximum diff bytes to return before truncating. Defaults to 512 KiB.",
        },
      },
      additionalProperties: false,
    },
  },
} as const;

export const gitDiff = async (
  options: GitDiffOptions = {},
): Promise<GitDiffResult> => {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const cwd = path.resolve(rootDir, options.cwd ?? ".");

  if (!isInsideRoot(rootDir, cwd)) {
    throw new Error(`Working directory is outside the workspace root: ${options.cwd}`);
  }

  const args = ["diff"];
  if (options.staged) {
    args.push("--cached");
  }

  if (options.statOnly) {
    args.push("--stat");
  }

  if (options.filePath) {
    const targetPath = path.resolve(rootDir, options.filePath);
    if (!isInsideRoot(rootDir, targetPath)) {
      throw new Error(`File is outside the workspace root: ${options.filePath}`);
    }

    args.push("--", path.relative(cwd, targetPath));
  }

  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: normalizeLimit(options.maxBytes, DEFAULT_MAX_BYTES),
  });
  const maxBytes = normalizeLimit(options.maxBytes, DEFAULT_MAX_BYTES);
  const diffBuffer = Buffer.from(stdout, "utf8");
  const truncated = diffBuffer.byteLength > maxBytes;
  const diff = truncated
    ? diffBuffer.subarray(0, maxBytes).toString("utf8")
    : stdout;

  return {
    rootDir,
    cwd: path.relative(rootDir, cwd) || ".",
    command: ["git", ...args],
    diff,
    truncated,
  };
};

export default {
  definition: gitDiffToolDefinition,
  execute: gitDiff,
};
