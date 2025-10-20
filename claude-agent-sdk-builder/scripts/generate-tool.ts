#!/usr/bin/env bun

/**
 * generate-tool.ts
 * Generates boilerplate for a new custom tool
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

interface Parameter {
  name: string;
  type: string;
  optional: boolean;
  description: string;
}

async function main() {
  console.log("🛠️  Custom Tool Generator\n");

  // Get tool details
  const toolName = await question("Tool name (e.g., search_database): ");
  if (!toolName || !/^[a-z_]+$/.test(toolName)) {
    console.error("❌ Tool name must be lowercase letters and underscores only");
    process.exit(1);
  }

  const description = await question("Tool description: ");
  if (!description) {
    console.error("❌ Description is required");
    process.exit(1);
  }

  // Get parameters
  console.log("\nAdd parameters (press Enter with empty name to finish):");
  const parameters: Parameter[] = [];

  while (true) {
    const paramName = await question(`  Parameter name: `);
    if (!paramName) break;

    const paramType = await question(`  Type (string/number/boolean/array): `);
    const optional = (await question(`  Optional? (y/n): `)).toLowerCase() === 'y';
    const paramDesc = await question(`  Description: `);

    parameters.push({
      name: paramName,
      type: paramType,
      optional,
      description: paramDesc,
    });
    console.log("  ✓ Parameter added\n");
  }

  rl.close();

  // Generate code
  console.log("\n📝 Generating tool code...\n");

  const code = generateToolCode(toolName, description, parameters);
  console.log(code);

  console.log("\n✅ Tool generated! Copy the code above into your MCP server.\n");
}

function generateToolCode(
  name: string,
  description: string,
  parameters: Parameter[]
): string {
  // Generate Zod schema
  const schemaLines: string[] = [];
  for (const param of parameters) {
    let zodType = "";
    switch (param.type) {
      case "string":
        zodType = "z.string()";
        break;
      case "number":
        zodType = "z.number()";
        break;
      case "boolean":
        zodType = "z.boolean()";
        break;
      case "array":
        zodType = "z.array(z.string())";
        break;
      default:
        zodType = "z.string()";
    }

    if (param.optional) {
      zodType += ".optional()";
    }

    zodType += `.describe("${param.description}")`;
    schemaLines.push(`    ${param.name}: ${zodType}`);
  }

  const schema = schemaLines.length > 0
    ? `{\n${schemaLines.join(",\n")}\n  }`
    : "{}";

  // Generate args usage
  const argsUsage = parameters.length > 0
    ? parameters.map(p => `      // args.${p.name}`).join("\n")
    : "      // No parameters";

  return `import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export const ${toCamelCase(name)}Tool = tool(
  "${name}",
  "${description}",
  ${schema},
  async (args) => {
    try {
${argsUsage}

      // TODO: Implement your tool logic here
      const result = {
        success: true,
        message: "Tool executed successfully"
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: \`Error: \${(error as Error).message}\`
        }]
      };
    }
  }
);

// Add to your MCP server:
// const myServer = createSdkMcpServer({
//   name: "mytools",
//   version: "1.0.0",
//   tools: [${toCamelCase(name)}Tool]
// });
//
// Use in agent with:
// allowedTools: ["mcp__mytools__${name}"]
`;
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

main().catch(console.error);
