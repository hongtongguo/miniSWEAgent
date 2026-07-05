import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runCommand } from "./runCommand";

const createWorkspace = () => mkdtemp(join(tmpdir(), "run-command-"));

describe("runCommand", () => {
  it("runs a command inside the workspace", async () => {
    const rootDir = await createWorkspace();

    const result = await runCommand({
      rootDir,
      command: "printf hello",
    });

    expect(result).toMatchObject({
      command: "printf hello",
      cwd: ".",
      exitCode: 0,
      stdout: "hello",
      stderr: "",
      timedOut: false,
    });
  });

  it("returns non-zero exit details without throwing", async () => {
    const rootDir = await createWorkspace();

    const result = await runCommand({
      rootDir,
      command: "sh -c 'printf problem >&2; exit 7'",
    });

    expect(result.exitCode).toBe(7);
    expect(result.stderr).toBe("problem");
  });

  it("rejects working directories outside the workspace", async () => {
    const rootDir = await createWorkspace();
    await mkdir(join(rootDir, "subdir"));

    await expect(runCommand({ rootDir, cwd: "..", command: "pwd" }))
      .rejects.toThrow("outside the workspace root");
  });
});
