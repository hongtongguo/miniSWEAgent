export type ToolParameterSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: readonly string[];
  additionalProperties?: boolean;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
};

export type ToolContext = {
  rootDir?: string;
};

export type ToolExecute<
  TOptions extends object = Record<string, unknown>,
  TResult = unknown,
> = (options: TOptions) => Promise<TResult>;

// Registry dispatches from model-provided JSON. Individual tools keep precise
// option types; the registry validates existence and leaves argument validation
// to each tool implementation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolExecute = (options: any) => Promise<unknown>;

export type ToolModule<
  TOptions extends object = Record<string, unknown>,
  TResult = unknown,
> = {
  definition: ToolDefinition;
  execute: ToolExecute<TOptions, TResult>;
};

export type AnyToolModule = {
  definition: ToolDefinition;
  execute: AnyToolExecute;
};

export type ToolCallResult<TResult = unknown> = {
  toolName: string;
  result: TResult;
};
