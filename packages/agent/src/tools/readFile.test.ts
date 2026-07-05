import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readFile } from "./readFile";

const createWorkspace = () => mkdtemp(join(tmpdir(), "read-file-"));

describe("readFile", () => {
  it("reads a selected one-based line range", async () => {
    const rootDir = await createWorkspace();
    await mkdir(join(rootDir, "docs"));
    await writeFile(join(rootDir, "docs", "notes.txt"), "one\ntwo\nthree\n");

    const result = await readFile({
      rootDir,
      filePath: "docs/notes.txt",
      startLine: 2,
      endLine: 3,
    });

    expect(result.path).toBe("docs/notes.txt");
    expect(result.content).toBe("two\nthree");
    expect(result.startLine).toBe(2);
    expect(result.endLine).toBe(3);
    expect(result.totalLines).toBe(4);
    expect(result.truncated).toBe(false);
  });

  it("rejects binary-looking files", async () => {
    const rootDir = await createWorkspace();
    await writeFile(join(rootDir, "binary.dat"), Buffer.from([65, 0, 66]));

    await expect(
      readFile({ rootDir, filePath: "binary.dat" }),
    ).rejects.toThrow("appears to be binary");
  });
});
