import { describe, expect, it } from "vitest";

import { parseSkillDescription } from "./markdown";

describe("parseSkillDescription", () => {
  it("extracts a quoted front matter description", () => {
    expect(
      parseSkillDescription(`---
name: demo
description: "Use this for demo tasks."
---
# Demo
`),
    ).toBe("Use this for demo tasks.");
  });

  it("preserves literal block descriptions", () => {
    expect(
      parseSkillDescription(`---
description: |
  First line.
  Second line.
---
`),
    ).toBe("First line.\nSecond line.");
  });

  it("folds folded block descriptions", () => {
    expect(
      parseSkillDescription(`---
description: >
  First line.
  Second line.
---
`),
    ).toBe("First line. Second line.");
  });

  it("returns an empty description when front matter is absent", () => {
    expect(parseSkillDescription("# Demo")).toBe("");
  });
});
