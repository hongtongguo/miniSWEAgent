import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type EditFileOptions = {
  filePath: string;
  rootDir?: string;
  content?: string;
  oldText?: string;
  newText?: string;
  replaceAll?: boolean;
  create?: boolean;
};

export type EditFileResult = {
  rootDir: string;
  path: string;
  created: boolean;
  changed: boolean;
  replacements: number;
  bytesWritten: number;
};

const isInsideRoot = (rootDir: string, target: string) => {
  const relativePath = path.relative(rootDir, target);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
};

const pathExists = async (filePath: string) => {
  try {
    await stat(filePath);
    return true;
  } catch (caughtError) {
    if (
      caughtError instanceof Error &&
      "code" in caughtError &&
      caughtError.code === "ENOENT"
    ) {
      return false;
    }

    throw caughtError;
  }
};

const countOccurrences = (content: string, search: string) => {
  if (search.length === 0) {
    throw new Error("oldText cannot be empty.");
  }

  let count = 0;
  let index = 0;

  while (index !== -1) {
    index = content.indexOf(search, index);
    if (index !== -1) {
      count += 1;
      index += search.length;
    }
  }

  return count;
};

export const editFileToolDefinition = {
  type: "function",
  function: {
    name: "edit_file",
    description:
      "Create, overwrite, or edit a UTF-8 text file in the workspace using exact text replacement.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "File path to edit, relative to the current workspace.",
        },
        content: {
          type: "string",
          description:
            "Full replacement content for the file. Mutually exclusive with oldText/newText.",
        },
        oldText: {
          type: "string",
          description: "Exact text to replace in the existing file.",
        },
        newText: {
          type: "string",
          description: "Replacement text for oldText.",
        },
        replaceAll: {
          type: "boolean",
          description:
            "Replace all occurrences of oldText instead of only the first occurrence.",
        },
        create: {
          type: "boolean",
          description:
            "Create the file and parent directories when it does not already exist.",
        },
      },
      required: ["filePath"],
      additionalProperties: false,
    },
  },
} as const;

export const editFile = async (
  options: EditFileOptions,
): Promise<EditFileResult> => {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const targetPath = path.resolve(rootDir, options.filePath);

  if (!isInsideRoot(rootDir, targetPath)) {
    throw new Error(`File is outside the workspace root: ${options.filePath}`);
  }

  const exists = await pathExists(targetPath);
  if (!exists && !options.create) {
    throw new Error(`File does not exist: ${options.filePath}`);
  }

  const usingFullContent = options.content !== undefined;
  const usingReplacement =
    options.oldText !== undefined || options.newText !== undefined;

  if (usingFullContent === usingReplacement) {
    throw new Error(
      "Provide either content or both oldText and newText, but not both.",
    );
  }

  let nextContent: string;
  let replacements = 0;

  if (usingFullContent) {
    nextContent = options.content ?? "";
    replacements = exists ? 1 : 0;
  } else {
    if (options.oldText === undefined || options.newText === undefined) {
      throw new Error("Both oldText and newText are required for replacement.");
    }

    const currentContent = exists
      ? await readFile(targetPath, "utf8")
      : "";
    replacements = countOccurrences(currentContent, options.oldText);

    if (replacements === 0) {
      throw new Error(`oldText was not found in: ${options.filePath}`);
    }

    nextContent = options.replaceAll
      ? currentContent.split(options.oldText).join(options.newText)
      : currentContent.replace(options.oldText, options.newText);
    replacements = options.replaceAll ? replacements : 1;
  }

  const previousContent = exists ? await readFile(targetPath, "utf8") : "";
  const changed = !exists || previousContent !== nextContent;

  if (changed) {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, nextContent, "utf8");
  }

  return {
    rootDir,
    path: path.relative(rootDir, targetPath),
    created: !exists,
    changed,
    replacements,
    bytesWritten: Buffer.byteLength(nextContent, "utf8"),
  };
};

export default {
  definition: editFileToolDefinition,
  execute: editFile,
};
