import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { gitDiff } from "./gitDiff";

const execFileAsync = promisify(execFile);
const createWorkspace = () => mkdtemp(join(tmpdir(), "git-diff-"));

const git = (rootDir: string, args: string[]) =>
  execFileAsync("git", args, { cwd: rootDir });

describe("gitDiff", () => {
  it("returns unstaged diff for a modified file", async () => {
    const rootDir = await createWorkspace();
    await git(rootDir, ["init"]);
    await git(rootDir, ["config", "user.email", "test@example.com"]);
    await git(rootDir, ["config", "user.name", "Test User"]);
    await writeFile(join(rootDir, "file.txt"), "before\n");
    await git(rootDir, ["add", "file.txt"]);
    await git(rootDir, ["commit", "-m", "initial"]);
    await writeFile(join(rootDir, "file.txt"), "after\n");

    const result = await gitDiff({ rootDir, filePath: "file.txt" });

    expect(result.cwd).toBe(".");
    expect(result.command).toEqual(["git", "diff", "--", "file.txt"]);
    expect(result.diff).toContain("-before");
    expect(result.diff).toContain("+after");
    expect(result.truncated).toBe(false);
  });

  it("rejects file paths outside the workspace root", async () => {
    const rootDir = await createWorkspace();

    await expect(gitDiff({ rootDir, filePath: "../file.txt" }))
      .rejects.toThrow("outside the workspace root");
  });
});
