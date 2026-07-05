import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AnyToolModule } from "../tools/types";
import { parseSkillDescription } from "../utils/markdown";

const skillPaths = [
  path.resolve(process.env.HOME || "/", ".codex/skills"),
  path.resolve("./skills"),
];

interface ISkill {
  name: string;
  directory: string;
  description: string;
}

type SkillToolOptions = {
  input: string;
  rootDir?: string;
};

type SkillExecutionResult = {
  skillName: string;
  mode: "script" | "instructions";
  exitCode: number;
  stdout: string;
  stderr: string;
};

function isValidSkillDirectory(directoryPath: string): boolean {
  const requiredFiles = "SKILL.md";
  return fs.existsSync(path.join(directoryPath, requiredFiles));
}

function loadSkills(): Record<string, ISkill> {
  const skills: Record<string, ISkill> = {};
  for (const skillPath of skillPaths) {
    try {
      fs.readdirSync(skillPath, {
        withFileTypes: true,
      })
        .filter(
          (dirent) =>
            dirent.isDirectory() &&
            isValidSkillDirectory(path.join(skillPath, dirent.name)),
        )
        .forEach((dirent) => {
          const skillDir = path.join(skillPath, dirent.name);
          const skillDefinitionPath = path.join(skillDir, "SKILL.md");
          const skillDefinition = fs.readFileSync(skillDefinitionPath, "utf-8");
          skills[dirent.name] = {
            name: dirent.name,
            description: parseSkillDescription(skillDefinition),
            directory: skillDir,
          };
        });
    } catch (error) {
      console.error(`Failed to load skill from ${skillPath}:`, error);
    }
  }
  return skills;
}

function executeSkill(
  skill: ISkill,
  options: SkillToolOptions,
): Promise<SkillExecutionResult> {
  const scriptPath = path.join(skill.directory, "execute.sh");
  if (!fs.existsSync(scriptPath)) {
    const skillDefinitionPath = path.join(skill.directory, "SKILL.md");
    return Promise.resolve({
      skillName: skill.name,
      mode: "instructions",
      exitCode: 0,
      stdout: fs.readFileSync(skillDefinitionPath, "utf8"),
      stderr: "",
    });
  }

  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const inputPayload = JSON.stringify(
    {
      ...options,
      rootDir,
      skillName: skill.name,
      skillDirectory: skill.directory,
    },
    null,
    2,
  );

  return new Promise((resolve, reject) => {
    const child = spawn("bash", [scriptPath], {
      cwd: skill.directory,
      env: {
        ...process.env,
        WORKSPACE_ROOT: rootDir,
        SKILL_NAME: skill.name,
        SKILL_DIR: skill.directory,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", reject);

    child.on("close", (exitCode) => {
      resolve({
        skillName: skill.name,
        mode: "script",
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      });
    });

    child.stdin.end(inputPayload);
  });
}

function skillToToolModule(skill: ISkill): AnyToolModule {
  return {
    definition: {
      type: "function",
      function: {
        name: skill.name,
        description: skill.description,
        parameters: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description:
                "The task, request, or context to pass to this skill.",
            },
          },
          required: ["input"],
          additionalProperties: false,
        },
      },
    },
    execute: (options: SkillToolOptions) => executeSkill(skill, options),
  };
}

function getSkillToolModules() {
  const skillsMap = loadSkills();
  return Object.values(skillsMap).map(skillToToolModule);
}

const skillToolModules = getSkillToolModules();

export { skillToolModules };
