import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { listFiles } from "./listFiles";

const createWorkspace = () => mkdtemp(join(tmpdir(), "list-files-"));

describe("listFiles", () => {
  it("lists visible files and directories in stable order", async () => {
    const rootDir = await createWorkspace();
    await mkdir(join(rootDir, "src"));
    await writeFile(join(rootDir, "README.md"), "hello");
    await writeFile(join(rootDir, "src", "index.ts"), "export {};");
    await writeFile(join(rootDir, ".env"), "SECRET=value");

    const result = await listFiles({ rootDir, maxDepth: 1 });

    expect(result.directory).toBe(".");
    expect(result.entries).toEqual([
      { path: "src", type: "directory", depth: 0 },
      { path: "src/index.ts", type: "file", depth: 1 },
      { path: "README.md", type: "file", depth: 0 },
    ]);
    expect(result.truncated).toBe(false);
  });

  it("rejects directories outside the workspace root", async () => {
    const rootDir = await createWorkspace();

    await expect(listFiles({ rootDir, directory: ".." })).rejects.toThrow(
      "outside the workspace root",
    );
  });
});
