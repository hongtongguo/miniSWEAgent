import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export type FileEntryType = "file" | "directory";

export type ListFilesOptions = {
  directory?: string;
  rootDir?: string;
  maxDepth?: number;
  maxEntries?: number;
  includeHidden?: boolean;
  ignore?: string[];
};

export type FileEntry = {
  path: string;
  type: FileEntryType;
  depth: number;
};

export type ListFilesResult = {
  rootDir: string;
  directory: string;
  entries: FileEntry[];
  truncated: boolean;
};

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_IGNORES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
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

export const listFilesToolDefinition = {
  type: "function",
  function: {
    name: "list_files",
    description:
      "List files and directories under a workspace directory with depth and entry limits.",
    parameters: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description:
            "Directory to list, relative to the current workspace. Defaults to the workspace root.",
        },
        maxDepth: {
          type: "number",
          description:
            "Maximum recursive depth. Use 0 to list only direct children.",
        },
        maxEntries: {
          type: "number",
          description: "Maximum number of entries to return before truncating.",
        },
        includeHidden: {
          type: "boolean",
          description: "Whether to include dotfiles and dot-directories.",
        },
      },
      additionalProperties: false,
    },
  },
} as const;

export const listFiles = async (
  options: ListFilesOptions = {},
): Promise<ListFilesResult> => {
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

  const maxDepth = normalizeLimit(options.maxDepth, DEFAULT_MAX_DEPTH);
  const maxEntries = normalizeLimit(options.maxEntries, DEFAULT_MAX_ENTRIES);
  const includeHidden = options.includeHidden ?? false;
  const ignoredNames = new Set([...DEFAULT_IGNORES, ...(options.ignore ?? [])]);
  const entries: FileEntry[] = [];
  let truncated = false;

  const visit = async (currentDir: string, depth: number): Promise<void> => {
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
      if (entries.length >= maxEntries) {
        truncated = true;
        return;
      }

      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath) || ".";

      if (entry.isDirectory()) {
        entries.push({
          path: relativePath,
          type: "directory",
          depth,
        });

        if (depth < maxDepth && !entry.isSymbolicLink()) {
          await visit(absolutePath, depth + 1);
        }

        continue;
      }

      if (entry.isFile() || entry.isSymbolicLink()) {
        entries.push({
          path: relativePath,
          type: "file",
          depth,
        });
      }
    }
  };

  await visit(targetDir, 0);

  return {
    rootDir,
    directory: path.relative(rootDir, targetDir) || ".",
    entries,
    truncated,
  };
};

export default {
  definition: listFilesToolDefinition,
  execute: listFiles,
};
