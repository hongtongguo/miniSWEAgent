import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { searchCode } from "./searchCode";

const createWorkspace = () => mkdtemp(join(tmpdir(), "search-code-"));

describe("searchCode", () => {
  it("finds text matches with requested context", async () => {
    const rootDir = await createWorkspace();
    await mkdir(join(rootDir, "src"));
    await writeFile(
      join(rootDir, "src", "agent.ts"),
      "before\nconst agent = true;\nafter\n",
    );

    const result = await searchCode({
      rootDir,
      query: "agent",
      contextLines: 1,
    });

    expect(result.matches).toEqual([
      {
        path: "src/agent.ts",
        line: 2,
        column: 7,
        text: "const agent = true;",
        before: ["before"],
        after: ["after"],
      },
    ]);
    expect(result.truncated).toBe(false);
  });

  it("supports regex and max result truncation", async () => {
    const rootDir = await createWorkspace();
    await writeFile(join(rootDir, "values.ts"), "foo1\nfoo2\nfoo3\n");

    const result = await searchCode({
      rootDir,
      query: "foo\\d",
      regex: true,
      maxResults: 2,
      contextLines: 0,
    });

    expect(result.matches).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });
});
