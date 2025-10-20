#!/usr/bin/env bun

/**
 * generate-subagent.ts
 * Generates in-code subagent configuration
 */

import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

const AVAILABLE_TOOLS = [
  "Read", "Write", "Edit", "Bash", "Grep", "Glob",
  "Task", "TodoWrite", "WebFetch", "WebSearch",
  "NotebookEdit", "BashOutput", "KillShell"
];

async function main() {
  console.log("🤖 In-Code Subagent Generator\n");

  // Get subagent details
  const name = await question("Subagent name (e.g., file-searcher): ");
  if (!name || !/^[a-z-]+$/.test(name)) {
    console.error("❌ Name must be lowercase letters and hyphens only");
    process.exit(1);
  }

  const description = await question("Description (what does this subagent do?): ");
  if (!description) {
    console.error("❌ Description is required");
    process.exit(1);
  }

  const role = await question("Role/specialty (e.g., 'file search specialist'): ");

  // Select tools
  console.log("\nAvailable tools:");
  AVAILABLE_TOOLS.forEach((tool, i) => {
    console.log(`  ${i + 1}. ${tool}`);
  });
  console.log("\nEnter tool numbers separated by commas (e.g., 1,2,5):");
  const toolInput = await question("Tools: ");

  const toolIndices = toolInput.split(',').map(s => parseInt(s.trim()) - 1);
  const selectedTools = toolIndices
    .filter(i => i >= 0 && i < AVAILABLE_TOOLS.length)
    .map(i => AVAILABLE_TOOLS[i]);

  if (selectedTools.length === 0) {
    console.error("❌ At least one tool must be selected");
    process.exit(1);
  }

  const maxTurns = await question("Max turns (default 10): ");
  const turns = maxTurns ? parseInt(maxTurns) : 10;

  // Choose pattern
  console.log("\nGenerate as:");
  console.log("1. Factory function (recommended)");
  console.log("2. Class-based");
  const patternChoice = await question("Choice (1-2): ");

  rl.close();

  console.log("\n📝 Generating subagent configuration...\n");

  let code: string;
  if (patternChoice === "2") {
    code = generateClassBased(name, description, role, selectedTools, turns);
  } else {
    code = generateFactoryFunction(name, description, role, selectedTools, turns);
  }

  console.log(code);
  console.log("\n✅ Subagent configuration generated!\n");
}

function generateFactoryFunction(
  name: string,
  description: string,
  role: string,
  tools: string[],
  maxTurns: number
): string {
  const functionName = `create${toPascalCase(name)}Subagent`;
  const toolsStr = tools.map(t => `"${t}"`).join(", ");

  return `/**
 * Factory function for ${name} subagent
 */
export function ${functionName}() {
  return {
    name: "${name}",
    description: "${description}",
    tools: [${toolsStr}],
    systemPrompt: \`
      You are a ${role}.

      Your responsibilities:
      - TODO: Add specific responsibilities
      - TODO: Add workflow steps
      - TODO: Add constraints or guidelines

      Available tools:
${tools.map(t => `      - ${t}: TODO: Describe usage`).join("\n")}

      Always provide clear, actionable results.
    \`,
    maxTurns: ${maxTurns}
  };
}

// Usage in main agent:
// const subagents = [
//   ${functionName}()
// ];
//
// options: {
//   subagents,
//   allowedTools: ["Task"]  // Allow spawning subagents
// }
//
// To spawn this subagent from main agent:
// Task({
//   subagent_type: "${name}",
//   description: "Brief task description",
//   prompt: "Detailed task for the subagent"
// })
`;
}

function generateClassBased(
  name: string,
  description: string,
  role: string,
  tools: string[],
  maxTurns: number
): string {
  const className = toPascalCase(name) + "Subagent";
  const toolsStr = tools.map(t => `"${t}"`).join(", ");

  return `/**
 * Class-based ${name} subagent
 */
export class ${className} {
  private config: SubagentConfig;

  constructor(
    private context?: any  // Optional: pass context/config
  ) {
    this.config = this.buildConfig();
  }

  private buildConfig(): SubagentConfig {
    return {
      name: "${name}",
      description: "${description}",
      tools: [${toolsStr}],
      systemPrompt: this.buildSystemPrompt(),
      maxTurns: ${maxTurns}
    };
  }

  private buildSystemPrompt(): string {
    return \`
      You are a ${role}.

      Your responsibilities:
      - TODO: Add specific responsibilities
      - TODO: Add workflow steps
      - TODO: Add constraints or guidelines

      Available tools:
${tools.map(t => `      - ${t}: TODO: Describe usage`).join("\n")}

      Always provide clear, actionable results.
    \`;
  }

  getConfig(): SubagentConfig {
    return this.config;
  }

  // Optional: methods to dynamically update configuration
  setMaxTurns(turns: number) {
    this.config.maxTurns = turns;
  }
}

// Usage in main agent:
// const subagent = new ${className}();
//
// options: {
//   subagents: [subagent.getConfig()],
//   allowedTools: ["Task"]
// }
//
// To spawn this subagent from main agent:
// Task({
//   subagent_type: "${name}",
//   description: "Brief task description",
//   prompt: "Detailed task for the subagent"
// })
`;
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

main().catch(console.error);
