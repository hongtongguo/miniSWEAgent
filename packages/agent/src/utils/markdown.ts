function stripYamlQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseBlockScalar(lines: string[], startIndex: number): string {
  const blockLines: string[] = [];
  let minIndent = Infinity;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      blockLines.push("");
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent === 0) {
      break;
    }

    minIndent = Math.min(minIndent, indent);
    blockLines.push(line);
  }

  if (!blockLines.length) {
    return "";
  }

  const indentToRemove = Number.isFinite(minIndent) ? minIndent : 0;
  return blockLines
    .map((line) => line.slice(Math.min(indentToRemove, line.length)))
    .join("\n")
    .trim();
}

export function parseSkillDescription(skillDefinition: string): string {
  const frontMatterMatch = skillDefinition.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontMatterMatch) {
    return "";
  }

  const lines = frontMatterMatch[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^description:\s*(.*)$/);
    if (!match) {
      continue;
    }

    const rawValue = match[1].trim();
    if (rawValue === "|" || rawValue === ">") {
      const blockValue = parseBlockScalar(lines, i + 1);
      return rawValue === ">"
        ? blockValue.replace(/\n+/g, " ").trim()
        : blockValue;
    }

    return stripYamlQuotes(rawValue);
  }

  return "";
}
