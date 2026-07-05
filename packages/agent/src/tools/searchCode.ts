import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export type SearchCodeOptions = {
  query: string;
  directory?: string;
  rootDir?: string;
  maxResults?: number;
  contextLines?: number;
  includeHidden?: boolean;
  caseSensitive?: boolean;
  regex?: boolean;
  ignore?: string[];
};

export type SearchCodeMatch = {
  path: string;
  line: number;
  column: number;
  text: string;
  before: string[];
  after: string[];
};

export type SearchCodeResult = {
  rootDir: string;
  directory: string;
  query: string;
  matches: SearchCodeMatch[];
  truncated: boolean;
};

const DEFAULT_MAX_RESULTS = 100;
const DEFAULT_CONTEXT_LINES = 2;
const MAX_FILE_BYTES = 1024 * 1024;
const DEFAULT_IGNORES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

const TEXT_FILE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".cts",
  ".env",
  ".go",
  ".graphql",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".less",
  ".mjs",
  ".mts",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);

const TEXT_FILE_NAMES = new Set([
  ".gitignore",
  ".npmrc",
  "Dockerfile",
  "Makefile",
  "README",
]);

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

const shouldSkipEntry = (
  name: string,
  includeHidden: boolean,
  ignoredNames: Set<string>,
) => {
  if (!includeHidden && name.startsWith(".")) {
    return true;
  }

  return ignoredNames.has(name);
};

const isLikelyTextFile = (filePath: string) => {
  const fileName = path.basename(filePath);

  return (
    TEXT_FILE_NAMES.has(fileName) ||
    TEXT_FILE_EXTENSIONS.has(path.extname(fileName))
  );
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildMatcher = (
  query: string,
  regex: boolean,
  caseSensitive: boolean,
) => {
  if (query.length === 0) {
    throw new Error("Search query cannot be empty.");
  }

  const flags = caseSensitive ? "g" : "gi";
  return new RegExp(regex ? query : escapeRegex(query), flags);
};

export const searchCodeToolDefinition = {
  type: "function",
  function: {
    name: "search_code",
    description:
      "Search source files under a workspace directory and return matching lines with optional surrounding context.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text or regex pattern to search for.",
        },
        directory: {
          type: "string",
          description:
            "Directory to search, relative to the current workspace. Defaults to the workspace root.",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of matches to return before truncating.",
        },
        contextLines: {
          type: "number",
          description:
            "Number of lines to include before and after each matching line.",
        },
        includeHidden: {
          type: "boolean",
          description: "Whether to include dotfiles and dot-directories.",
        },
        caseSensitive: {
          type: "boolean",
          description: "Whether matching should be case-sensitive.",
        },
        regex: {
          type: "boolean",
          description:
            "Treat query as a JavaScript regular expression instead of literal text.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
} as const;

export const searchCode = async (
  options: SearchCodeOptions,
): Promise<SearchCodeResult> => {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const directory = options.directory ?? ".";
  const targetDir = path.resolve(rootDir, directory);

  if (!isInsideRoot(rootDir, targetDir)) {
    throw new Error(`Directory is outside the workspace root: ${directory}`);
  }

  const targetStats = await stat(targetDir);
  if (!targetStats.isDirectory()) {
    throw new Error(`Path is not a directory: ${directory}`);
  }

  const maxResults = normalizeLimit(options.maxResults, DEFAULT_MAX_RESULTS);
  const contextLines = normalizeLimit(
    options.contextLines,
    DEFAULT_CONTEXT_LINES,
  );
  const includeHidden = options.includeHidden ?? false;
  const ignoredNames = new Set([...DEFAULT_IGNORES, ...(options.ignore ?? [])]);
  const matcher = buildMatcher(
    options.query,
    options.regex ?? false,
    options.caseSensitive ?? false,
  );
  const matches: SearchCodeMatch[] = [];
  let truncated = false;

  const searchFile = async (filePath: string) => {
    if (truncated || !isLikelyTextFile(filePath)) {
      return;
    }

    const fileStats = await stat(filePath);
    if (fileStats.size > MAX_FILE_BYTES) {
      return;
    }

    const content = await readFile(filePath, "utf8");
    if (content.includes("\u0000")) {
      return;
    }

    const lines = content.split(/\r?\n/);
    const relativePath = path.relative(rootDir, filePath);

    for (const [lineIndex, text] of lines.entries()) {
      if (matches.length >= maxResults) {
        truncated = true;
        return;
      }

      matcher.lastIndex = 0;
      const match = matcher.exec(text);
      if (!match) {
        continue;
      }

      const beforeStart = Math.max(0, lineIndex - contextLines);
      const afterEnd = Math.min(lines.length, lineIndex + contextLines + 1);

      matches.push({
        path: relativePath,
        line: lineIndex + 1,
        column: match.index + 1,
        text,
        before: lines.slice(beforeStart, lineIndex),
        after: lines.slice(lineIndex + 1, afterEnd),
      });
    }
  };

  const visit = async (currentDir: string): Promise<void> => {
    if (truncated) {
      return;
    }

    const dirEntries = await readdir(currentDir, { withFileTypes: true });
    const visibleEntries = dirEntries
      .filter((entry) => !shouldSkipEntry(entry.name, includeHidden, ignoredNames))
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      });

    for (const entry of visibleEntries) {
      if (truncated) {
        return;
      }

      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.isSymbolicLink()) {
          await visit(absolutePath);
        }

        continue;
      }

      if (entry.isFile() || entry.isSymbolicLink()) {
        await searchFile(absolutePath);
      }
    }
  };

  await visit(targetDir);

  return {
    rootDir,
    directory: path.relative(rootDir, targetDir) || ".",
    query: options.query,
    matches,
    truncated,
  };
};

export default {
  definition: searchCodeToolDefinition,
  execute: searchCode,
};
