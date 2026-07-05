# Repository Guidelines

## Project Structure & Module Organization

This repository is a TypeScript ESM CLI project. Source lives under `src/`:

- `src/cli/index.tsx` contains the Ink-based terminal UI and executable entry point.
- `src/core/` contains agent orchestration, OpenAI client setup, state management, and skill wrapping.
- `src/tools/` contains tool modules plus `toolRegistry.ts`, which wires model-facing tool definitions to implementations.
- `src/constant.ts` stores model and API configuration constants.

Build output is generated in `dist/` and should not be edited by hand. The current repo has no dedicated `tests/` directory yet.

## Build, Test, and Development Commands

Use pnpm, matching `packageManager` in `package.json`.

- `pnpm install` installs dependencies from `pnpm-lock.yaml`.
- `pnpm dev` runs the CLI directly from `src/cli/index.tsx` with `tsx`.
- `pnpm build` typechecks, bundles the CLI with esbuild, emits declarations, and writes `dist/cli/index.js`.
- `pnpm start` runs the built CLI from `dist/`.
- `pnpm typecheck` runs `tsc --noEmit`.
- `pnpm test` currently aliases the typecheck gate.

## Coding Style & Naming Conventions

Write strict TypeScript and keep modules ESM-compatible. Use two-space indentation, double quotes, trailing commas where the existing code uses them, and explicit exported types for shared contracts. Prefer `camelCase` for functions and variables, `PascalCase` for React components and classes, and descriptive tool filenames such as `readFile.ts` or `searchCode.ts`.

When adding a tool, implement it in `src/tools/`, export its typed module, and register it in `src/tools/toolRegistry.ts`.

## Testing Guidelines

There is no separate unit test framework configured yet. For now, run `pnpm test` before submitting changes and treat TypeScript errors as blocking. If adding behavior-heavy logic, add a test framework deliberately and place tests near the relevant module or under a new `tests/` directory using names like `agentLoop.test.ts`.

## Commit & Pull Request Guidelines

The current Git history is minimal, with a short lowercase commit subject (`dev`). Keep commits concise and imperative, for example `add file search tool` or `fix agent loop handling`. Pull requests should include a brief summary, validation steps such as `pnpm test`, linked issues when applicable, and terminal screenshots only when UI behavior changes.

## Security & Configuration Tips

Do not add new hard-coded API keys or secrets. Prefer environment-based configuration for credentials and document any required variables in the PR. Avoid committing generated `dist/` output unless the project explicitly requires packaged artifacts for a release.
