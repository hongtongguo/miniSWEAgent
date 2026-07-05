import editFileTool, { editFile } from "./editFile";
import gitDiffTool, { gitDiff } from "./gitDiff";
import listFilesTool, { listFiles } from "./listFiles";
import readFileTool, { readFile } from "./readFile";
import runCommandTool, { runCommand } from "./runCommand";
import searchCodeTool, { searchCode } from "./searchCode";
import { skillToolModules } from "../core/skillWrapper";
import type { AnyToolModule, ToolCallResult, ToolContext, ToolDefinition } from "./types";

export const toolModules = [
  listFilesTool as AnyToolModule,
  readFileTool as AnyToolModule,
  searchCodeTool as AnyToolModule,
  editFileTool as AnyToolModule,
  runCommandTool as AnyToolModule,
  gitDiffTool as AnyToolModule,
  ...skillToolModules,
];

export const tools: ToolDefinition[] = toolModules.map((tool) => tool.definition);

export const toolRegistry: Map<string, AnyToolModule> = new Map(
  toolModules.map((tool) => [tool.definition.function.name, tool]),
);

export type ToolName =
  | "list_files"
  | "read_file"
  | "search_code"
  | "edit_file"
  | "run_command"
  | "git_diff";

export const executeTool = async (
  toolName: string,
  args: Record<string, unknown> = {},
  context: ToolContext = {},
): Promise<ToolCallResult> => {
  const tool = toolRegistry.get(toolName);

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const result = await tool.execute({
    ...args,
    rootDir: context.rootDir,
  });

  return {
    toolName,
    result,
  };
};

export {
  editFile,
  gitDiff,
  listFiles,
  readFile,
  runCommand,
  searchCode,
};
