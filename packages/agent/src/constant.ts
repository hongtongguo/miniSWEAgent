export const API_KEY = "sk-68342d0f00f24349a537f423e4342b8e";
export const API_ENDPOINT = "https://api.deepseek.com";

export const DEFAULT_MODEL = "deepseek-v4-flash";
export const REASONING_MODEL = "deepseek-v4-pro";

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "deepseek-v4-flash": 1_000_000,
  "deepseek-v4-pro": 1_000_000,
};

export const DEFAULT_RESERVED_OUTPUT_TOKENS = 64_000;
