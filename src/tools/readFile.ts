import { readFile as fsReadFile, stat } from "node:fs/promises";
import path from "node:path";

export type ReadFileOptions = {
  filePath: string;
  rootDir?: string;
  startLine?: number;
  endLine?: number;
  maxBytes?: number;
};

export type ReadFileResult = {
  rootDir: string;
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  truncated: boolean;
};

const DEFAULT_MAX_BYTES = 512 * 1024;

const normalizeLimit = (value: number | undefined, fallback: number) => {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
};

const normalizeLine = (value: number | undefined, fallback: number) => {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
};

const isInsideRoot = (rootDir: string, target: string) => {
  const relativePath = path.relative(rootDir, target);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
};

export const readFileToolDefinition = {
  type: "function",
  function: {
    name: "read_file",
    description:
      "Read a UTF-8 text file from the workspace with optional line range and size limits.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "File path to read, relative to the current workspace.",
        },
        startLine: {
          type: "number",
          description: "First 1-based line number to include. Defaults to 1.",
        },
        endLine: {
          type: "number",
          description: "Last 1-based line number to include.",
        },
        maxBytes: {
          type: "number",
          description:
            "Maximum number of bytes to read before truncating. Defaults to 512 KiB.",
        },
      },
      required: ["filePath"],
      additionalProperties: false,
    },
  },
} as const;

export const readFile = async (
  options: ReadFileOptions,
): Promise<ReadFileResult> => {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const targetPath = path.resolve(rootDir, options.filePath);

  if (!isInsideRoot(rootDir, targetPath)) {
    throw new Error(`File is outside the workspace root: ${options.filePath}`);
  }

  const fileStats = await stat(targetPath);
  if (!fileStats.isFile()) {
    throw new Error(`Path is not a file: ${options.filePath}`);
  }

  const maxBytes = normalizeLimit(options.maxBytes, DEFAULT_MAX_BYTES);
  const fileHandle = await fsReadFile(targetPath);
  const truncated = fileHandle.byteLength > maxBytes;
  const buffer = truncated ? fileHandle.subarray(0, maxBytes) : fileHandle;
  const content = buffer.toString("utf8");

  if (content.includes("\u0000")) {
    throw new Error(`File appears to be binary: ${options.filePath}`);
  }

  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;
  const startLine = normalizeLine(options.startLine, 1);
  const endLine = Math.min(
    normalizeLine(options.endLine, totalLines),
    totalLines,
  );
  const selectedLines =
    startLine <= endLine ? lines.slice(startLine - 1, endLine) : [];

  return {
    rootDir,
    path: path.relative(rootDir, targetPath),
    content: selectedLines.join("\n"),
    startLine,
    endLine,
    totalLines,
    truncated,
  };
};

export default {
  definition: readFileToolDefinition,
  execute: readFile,
};
