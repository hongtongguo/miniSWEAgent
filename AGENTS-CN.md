# 仓库指南

## 项目结构与模块组织

本仓库是一个 TypeScript ESM CLI 项目。源码位于 `src/`：

- `src/cli/index.tsx` 包含基于 Ink 的终端 UI 和可执行入口。
- `src/core/` 包含 agent 编排、OpenAI 客户端设置、状态管理和 skill 封装。
- `src/tools/` 包含工具模块以及 `toolRegistry.ts`，负责将面向模型的工具定义连接到具体实现。
- `src/constant.ts` 存放模型和 API 配置常量。

构建产物生成在 `dist/` 中，不应手动编辑。当前仓库尚未设置独立的 `tests/` 目录。

## 构建、测试与开发命令

请使用 pnpm，与 `package.json` 中的 `packageManager` 保持一致。

- `pnpm install` 根据 `pnpm-lock.yaml` 安装依赖。
- `pnpm dev` 使用 `tsx` 直接从 `src/cli/index.tsx` 运行 CLI。
- `pnpm build` 执行类型检查，使用 esbuild 打包 CLI，生成声明文件，并写入 `dist/cli/index.js`。
- `pnpm start` 从 `dist/` 运行已构建的 CLI。
- `pnpm typecheck` 执行 `tsc --noEmit`。
- `pnpm test` 当前等同于类型检查门禁。

## 编码风格与命名约定

编写严格的 TypeScript，并保持模块兼容 ESM。使用两个空格缩进、双引号，并在现有代码使用尾随逗号的地方继续保持一致。共享契约应显式导出类型。函数和变量使用 `camelCase`，React 组件和类使用 `PascalCase`，工具文件名应具备描述性，例如 `readFile.ts` 或 `searchCode.ts`。

添加新工具时，在 `src/tools/` 中实现，导出其带类型的模块，并在 `src/tools/toolRegistry.ts` 中注册。

## 测试指南

当前尚未配置独立的单元测试框架。提交变更前请运行 `pnpm test`，并将 TypeScript 错误视为阻塞问题。如果新增行为较复杂的逻辑，应有意识地引入测试框架，并将测试放在相关模块附近，或放入新的 `tests/` 目录，命名示例为 `agentLoop.test.ts`。

## 提交与 Pull Request 指南

当前 Git 历史较少，已有提交使用简短的小写主题（`dev`）。提交信息应保持简洁、祈使语气，例如 `add file search tool` 或 `fix agent loop handling`。Pull Request 应包含简短摘要、验证步骤（如 `pnpm test`）、相关 issue 链接；只有在 UI 行为变化时才需要附终端截图。

## 安全与配置提示

不要新增硬编码 API key 或其他密钥。凭据应优先使用基于环境变量的配置，并在 PR 中说明所需变量。除非项目明确要求在发布中包含打包产物，否则避免提交生成的 `dist/` 输出。
