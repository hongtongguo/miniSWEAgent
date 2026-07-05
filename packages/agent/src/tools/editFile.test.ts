import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { editFile } from "./editFile";

const createWorkspace = () => mkdtemp(join(tmpdir(), "edit-file-"));

describe("editFile", () => {
  it("creates parent directories when writing new content", async () => {
    const rootDir = await createWorkspace();

    const result = await editFile({
      rootDir,
      filePath: "nested/file.txt",
      content: "hello",
      create: true,
    });

    expect(result).toMatchObject({
      path: "nested/file.txt",
      created: true,
      changed: true,
      replacements: 0,
      bytesWritten: 5,
    });
    await expect(readFile(join(rootDir, "nested", "file.txt"), "utf8"))
      .resolves.toBe("hello");
  });

  it("replaces only the first occurrence by default", async () => {
    const rootDir = await createWorkspace();
    await writeFile(join(rootDir, "file.txt"), "red red red");

    const result = await editFile({
      rootDir,
      filePath: "file.txt",
      oldText: "red",
      newText: "blue",
    });

    expect(result.replacements).toBe(1);
    await expect(readFile(join(rootDir, "file.txt"), "utf8")).resolves.toBe(
      "blue red red",
    );
  });

  it("rejects replacement requests when oldText is absent", async () => {
    const rootDir = await createWorkspace();
    await writeFile(join(rootDir, "file.txt"), "content");

    await expect(
      editFile({
        rootDir,
        filePath: "file.txt",
        oldText: "missing",
        newText: "replacement",
      }),
    ).rejects.toThrow("oldText was not found");
  });
});
